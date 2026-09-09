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

        public record TrainingOutcome(
            string EventId, DateTime? EventDate,
            int? AssistanceTypeId, int? ExcuseTypeId, int? ConvocationStatusId);

        public record Result(
            int? Readiness,
            double TrainingComponent,
            double MatchComponent,
            int SessionsConsidered,
            int MatchMinutesInWindow,
            RecentAbsence[] RecentAbsences);

        public record RecentAbsence(string EventId, DateTime? Date, string Reason, int PointsImpact);

        public static Result Calculate(
            IReadOnlyList<TrainingOutcome> trainingOutcomesInWindow,
            IReadOnlyList<int> matchMinutesInWindow)
        {
            var scored = trainingOutcomesInWindow
                .Select(o => (Outcome: o, Points: PointsFor(o)))
                .Where(x => x.Points is not null)
                .ToList();

            var sessionsConsidered = scored.Count;
            var scoringSum = scored.Where(x => IsRealAttendance(x.Outcome)).Sum(x => x.Points!.Value);
            var trainingComponent = sessionsConsidered == 0
                ? 0d
                : Math.Min(100d, scoringSum / (double)(BaselineTrainings * 100) * 100d);

            var matchMinutes = matchMinutesInWindow.Sum();
            var matchComponent = Math.Min(
                100d,
                matchMinutes / (double)(BaselineMatches * ExpectedMinutesPerMatch) * 100d);

            int? readiness = sessionsConsidered == 0 && matchMinutes == 0
                ? null
                : (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);

            var recentAbsences = scored
                .Where(x => x.Points!.Value < 100)
                .Select(x => new RecentAbsence(
                    x.Outcome.EventId, x.Outcome.EventDate, ReasonFor(x.Outcome), x.Points!.Value - 100))
                .OrderByDescending(a => a.Date)
                .Take(10)
                .ToArray();

            return new Result(readiness, trainingComponent, matchComponent, sessionsConsidered, matchMinutes, recentAbsences);
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
