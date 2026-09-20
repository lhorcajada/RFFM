using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Pure, side-effect-free calculator for a player's "Rodaje" (0-100), derived from
    /// recent training attendance (70% weight) and match minutes (30% weight) over a rolling
    /// 8-week window. No EF/DB access — the handler projects raw data into
    /// <see cref="TrainingOutcome"/>/minutes lists and calls <see cref="Calculate"/>.
    /// See openspec/changes/squad-statistics-form-status/design.md → Decisión 2.
    /// </summary>
    public static class PlayerReadinessCalculator
    {
        public const int WindowWeeks = 8;
        public const int BaselineTrainings = 16;   // sesiones convocadas para "plena forma"
        public const int BaselineMatches = 8;      // partidos convocados para "plena forma"
        public const int ExpectedMinutesPerMatch = 70;
        public const double TrainingWeight = 0.70;
        public const double MatchWeight = 0.30;

        // Pesos por tipo de entrenamiento para Rodaje: mide "cuánto lista está la cabeza/el
        // automatismo de juego del jugador para competir", no su desgaste físico — un entreno
        // táctico (donde se ensayan patrones de juego reales) aporta más a esa soltura
        // competitiva que uno técnico (aislado, sin contexto de juego), y un entreno puramente
        // físico aporta poco (0.30: algo de ritmo/rodaje, enmienda de player-form-status-received-offered-load, Decisión 11). Judgment
        // call documentado, igual que TrainingWeight/MatchWeight arriba — ver design.md
        // (player-form-status-training-match-weighting) → Decisión 1. Sesión sin tipos marcados
        // usa TrainingTypeWeighting.UntypedWeight (1.00), preservando el comportamiento pre-change.
        private static readonly IReadOnlyDictionary<string, double> ReadinessTrainingWeights = new Dictionary<string, double>
        {
            [TrainingType.Fisico.Code] = 0.30,
            [TrainingType.Tactico.Code] = 1.00,
            [TrainingType.Tecnico.Code] = 0.60,
        };

        public record TrainingOutcome(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            int? AssistanceTypeId, int? ExcuseTypeId, int? ConvocationStatusId);

        public record Result(
            int? Readiness,
            double TrainingComponent,
            double MatchComponent,
            int SessionsConsidered,
            // Suma ponderada por tipo de partido (Decisión 2), no minutos reales jugados — un
            // partido de Liga cuenta 1:1 pero un amistoso/torneo cuenta al 70% de sus minutos
            // reales. Ver design.md → Decisión 3.
            int MatchMinutesInWindow,
            RecentAbsence[] RecentAbsences,
            // Decisión (transparency addendum, ver design.md → "Transparencia del desglose"):
            // lista de TODAS las sesiones/partidos realmente considerados (no solo las ausencias
            // de RecentAbsences), con su peso por tipo y su aportación real al numerador — el
            // mismo dato que ya tenía RecentAbsences pero generalizado a asistencias completas
            // también, para poder mostrar "12/09 · Táctico · peso 1.00 → 100 pts" igual que una
            // ausencia. RecentAbsences se mantiene tal cual para no romper a quien ya lo consume.
            ConsideredTraining[] ConsideredTrainings,
            ConsideredMatch[] ConsideredMatches);

        public record RecentAbsence(string EventId, DateTime? Date, string Reason, int PointsImpact);

        public record ConsideredTraining(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            bool CountsTowardScore,   // false = ausencia (cualquier motivo); ver IsRealAttendance
            double Points,           // 0-100, puntuación bruta por el motivo/tipo de asistencia (PointsFor)
            double TypeWeight,       // peso por tipo de entrenamiento (solo aplica si CountsTowardScore)
            double Contribution,     // Points * TypeWeight si CountsTowardScore, si no 0 — lo que realmente suma al numerador
            string Reason);

        public record ConsideredMatch(
            string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
            double TypeWeight, double EffectiveMinutes);

        public static Result Calculate(
            IReadOnlyList<TrainingOutcome> trainingOutcomesInWindow,
            IReadOnlyList<(string EventId, DateTime? EventDate, int MinutesPlayed, int EventTypeId)> matchesInWindow)
        {
            var scored = trainingOutcomesInWindow
                .Select(o => (Outcome: o, Points: PointsFor(o)))
                .Where(x => x.Points is not null)
                .ToList();

            var sessionsConsidered = scored.Count;

            var consideredTrainings = scored
                .Select(x =>
                {
                    var countsTowardScore = IsRealAttendance(x.Outcome);
                    var typeWeight = TrainingTypeWeighting.Weight(x.Outcome.TrainingTypes, ReadinessTrainingWeights);
                    var contribution = countsTowardScore ? x.Points!.Value * typeWeight : 0d;
                    return new ConsideredTraining(
                        x.Outcome.EventId, x.Outcome.EventDate, x.Outcome.TrainingTypes,
                        countsTowardScore, x.Points!.Value, typeWeight, contribution, ReasonFor(x.Outcome));
                })
                .OrderByDescending(c => c.EventDate)
                .ToArray();
            var scoringSum = consideredTrainings.Sum(c => c.Contribution);
            var trainingComponent = sessionsConsidered == 0
                ? 0d
                : Math.Min(100d, scoringSum / (double)(BaselineTrainings * 100) * 100d);

            var consideredMatches = matchesInWindow
                .Select(m =>
                {
                    var typeWeight = MatchTypeWeighting.Weight(m.EventTypeId);
                    return new ConsideredMatch(m.EventId, m.EventDate, m.EventTypeId, m.MinutesPlayed, typeWeight, m.MinutesPlayed * typeWeight);
                })
                .OrderByDescending(c => c.EventDate)
                .ToArray();
            var matchMinutes = consideredMatches.Sum(c => c.EffectiveMinutes);
            var matchComponent = Math.Min(
                100d,
                matchMinutes / (double)(BaselineMatches * ExpectedMinutesPerMatch) * 100d);

            int? readiness = sessionsConsidered == 0 && matchMinutes == 0
                ? null
                : (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);

            var recentAbsences = consideredTrainings
                .Where(c => c.Points < 100)
                .Select(c => new RecentAbsence(c.EventId, c.EventDate, c.Reason, (int)c.Points - 100))
                .OrderByDescending(a => a.Date)
                .Take(10)
                .ToArray();

            return new Result(readiness, trainingComponent, matchComponent, sessionsConsidered, (int)matchMinutes, recentAbsences, consideredTrainings, consideredMatches);
        }

        // Solo asistencia real (presente o tarde) suma al numerador de TrainingComponent — ver
        // Addendum 2 en design.md. Cualquier ausencia (lesión, injustificada, justificada,
        // decisión técnica, etc.) contribuye 0, aunque siga apareciendo en RecentAbsences con su
        // PointsImpact original (informativo, no afecta al cálculo).
        private static bool IsRealAttendance(TrainingOutcome o) =>
            o.AssistanceTypeId == AssistanceType.Attendance.Id || o.AssistanceTypeId == AssistanceType.LateArrival.Id;

        // Orden de comprobación: motivo de ausencia manda sobre el tipo de asistencia genérico.
        private static int? PointsFor(TrainingOutcome o)
        {
            if (o.ExcuseTypeId == ExcuseTypes.FromId(1)?.Id) return 10;   // Lesión — penalización máxima
            if (o.ExcuseTypeId == ExcuseTypes.FromId(7)?.Id) return null; // Decisión técnica — no penaliza, excluido
            if (o.AssistanceTypeId == AssistanceType.Attendance.Id) return 100;
            if (o.AssistanceTypeId == AssistanceType.LateArrival.Id) return 80;
            if (o.AssistanceTypeId == AssistanceType.UnexcusedAbsence.Id) return 20;
            if (o.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id) return 45; // resto de motivos justificados
            if (o.AssistanceTypeId is null && o.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id) return null; // decisión del coach, excluido
            if (o.AssistanceTypeId is null && o.ConvocationStatusId == ConvocationStatus.FromName("Justified").Id) return 45;
            return null; // pendiente / sin resultado registrado — excluido del cálculo
        }

        private static string ReasonFor(TrainingOutcome o)
        {
            if (o.ExcuseTypeId is not null && ExcuseTypes.FromId(o.ExcuseTypeId.Value) is { } excuse) return excuse.Name;
            if (o.AssistanceTypeId is not null) return AssistanceType.From(o.AssistanceTypeId.Value).Name;
            return "Sin motivo registrado";
        }
    }
}
