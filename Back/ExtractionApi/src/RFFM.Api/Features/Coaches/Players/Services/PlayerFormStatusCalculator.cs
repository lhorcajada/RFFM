using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Pure, side-effect-free calculator for a player's "Estado de forma" (0-100 or null): the
    /// quotient between the load the player received and the load the team offered him, over a
    /// 6-week window with recency weighting, multiplied by a Cansancio factor. 100% is the normal
    /// value of a healthy player who attends and plays; it only drops by absences, low minutes
    /// and fatigue. The handler classifies each convocation (see <see cref="FormStatusOutcome"/>)
    /// and passes the already computed Cansancio; this class does no EF/DB access.
    /// FormStatus = (0.55·Entrenos + 0.45·Partidos) × (1 − Fatigue/200), con Entrenos/Partidos =
    /// Entrenos = ratio recibido÷ofrecido × factor de volumen (min(1, sesiones asistidas / 12));
    /// Partidos = media ponderada por recencia de min(1, minutos/FullMatchMinutes), sin factor de volumen
    /// (el número de partidos depende del calendario del equipo, no del jugador).
    /// See openspec/changes/player-form-status-received-offered-load/design.md → Decisiones 1-12.
    /// </summary>
    public static class PlayerFormStatusCalculator
    {
        public const int WindowDays = FormStatusRecency.WindowDays;
        public const int RecencyFullWeightDays = FormStatusRecency.RecencyFullWeightDays;
        public const int RecencyHalfLifeDays = FormStatusRecency.RecencyHalfLifeDays;

        // Pesos nominales de los dos bloques. El entreno pesa algo más porque es lo que el
        // entrenador ofrece de forma constante; el partido, aun siendo el mayor estímulo, solo
        // ocurre una vez por semana. Se renormalizan a 1.00 si falta un bloque.
        public const double TrainingWeightNominal = 0.55;
        public const double MatchWeightNominal = 0.45;

        // 87.5% de la duración del partido = "estímulo completo" (Cadete: 70 de 80 minutos): un
        // jugador que juega casi todo el partido ya ha recibido la carga completa, y el tiempo
        // añadido/cambios no deberían impedir alcanzar el 100%.
        public const double FullStimulusFraction = 0.875;

        // Decisión 12 (factor de volumen de ENTRENOS): sesiones asistidas de referencia en la ventana
        // de 42 días para poder alcanzar el 100% (2 por semana x 6 semanas). No hay factor de
        // volumen de partidos: depende del calendario del equipo, no del jugador.
        public const int ReferenceTrainingSessions = 12;

        public const string MatchStatusPlayed = "Played";
        public const string MatchStatusNotPlayed = "NotPlayed";
        public const string MatchStatusAbsent = "Absent";

        // Pesos por tipo de entrenamiento para Estado de forma: mide condición física de base, así
        // que el físico manda (1.00); el táctico aporta algo porque incluye carga de movimiento/
        // intensidad dentro de contexto de juego (0.50); el técnico no mejora la condición física
        // en absoluto (0.00). Ver design.md → Decisión 1/3 del change previo y Decisión 3 de éste.
        private static readonly IReadOnlyDictionary<string, double> FormStatusTrainingWeights = new Dictionary<string, double>
        {
            [TrainingType.Fisico.Code] = 1.00,
            [TrainingType.Tactico.Code] = 0.50,
            [TrainingType.Tecnico.Code] = 0.00,
        };

        public record TrainingParticipation(
            string EventId, DateTime? EventDate, int DaysAgo, IReadOnlyList<string> TrainingTypes,
            ParticipationOutcome Outcome, string? AbsenceReason = null);

        public record MatchInput(
            string EventId, DateTime? EventDate, int EventTypeId, int DaysAgo, int MinutesPlayed, ParticipationOutcome Outcome);

        public record ConsideredTraining(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            int DaysAgo, double RecencyWeight, double TypeWeight, double OfferedLoad,
            bool Attended, double ReceivedLoad, string? AbsenceReason);

        public record ConsideredMatch(
            string EventId, DateTime? EventDate, int EventTypeId,
            int DaysAgo, double RecencyWeight, int MinutesPlayed, double FullMatchMinutes,
            double Ratio, double Contribution, string Status);

        public record Result(
            int? FormStatus,
            double? TrainingComponent,
            int TrainingSessionsOffered,
            int TrainingSessionsAttended,
            double TrainingLoadOffered,
            double TrainingLoadReceived,
            bool TrainingTypeWeightFallbackUsed,
            int ExcludedTrainings,
            double? MatchComponent,
            int MatchesConsidered,
            int CategoryMatchMinutes,
            double FullStimulusFraction,
            double FullMatchMinutes,
            double MatchRecencyWeightSum,
            double MatchRatioWeightedSum,
            int ExcludedMatches,
            double TrainingWeightNominal,
            double MatchWeightNominal,
            double TrainingWeightApplied,
            double MatchWeightApplied,
            double BaseScore,
            int Fatigue,
            double FatigueFactor,
            int ReferenceTrainingSessions,
            double? TrainingRatioComponent,
            double? TrainingVolumeFactor,
            int MatchMinutesPlayedTotal,
            int MatchMinutesPossibleTotal,
            ConsideredTraining[] ConsideredTrainings,
            ConsideredMatch[] ConsideredMatches);

        /// <param name="categoryHalfMinutes">Minutos de CADA PARTE (MatchDurationMinutesByCategory).</param>
        public static Result Calculate(
            IReadOnlyList<TrainingParticipation> trainings,
            IReadOnlyList<MatchInput> matches,
            int fatigue,
            int categoryHalfMinutes)
        {
            var categoryMatchMinutes = 2 * categoryHalfMinutes;
            var fullMatchMinutes = FullStimulusFraction * categoryMatchMinutes;

            // ── Entrenos ──
            var trainingsInWindow = trainings.Where(t => t.DaysAgo <= WindowDays).ToList();
            var excludedTrainings = trainingsInWindow.Count(t => t.Outcome == ParticipationOutcome.Excluded);
            var offered = trainingsInWindow.Where(t => t.Outcome != ParticipationOutcome.Excluded).ToList();

            var typeWeights = offered
                .Select(t => TrainingTypeWeighting.Weight(t.TrainingTypes, FormStatusTrainingWeights))
                .ToList();
            // Sesiones Técnicas puras pesan 0: si TODAS las ofrecidas pesan 0 el cociente sería 0/0,
            // así que se usa peso 1.00 (asistencia por recencia) y se avisa al cliente.
            var fallbackUsed = offered.Count > 0 && typeWeights.Sum() == 0;

            var consideredTrainings = offered
                .Select((t, i) =>
                {
                    var w = fallbackUsed ? 1.0 : typeWeights[i];
                    var r = FormStatusRecency.Weight(t.DaysAgo);
                    var attended = t.Outcome == ParticipationOutcome.Attended;
                    return new ConsideredTraining(
                        t.EventId, t.EventDate, t.TrainingTypes, t.DaysAgo, r, w, w * r,
                        attended, attended ? w * r : 0d, attended ? null : t.AbsenceReason);
                })
                .OrderByDescending(c => c.EventDate)
                .ThenBy(c => c.DaysAgo)
                .ToArray();

            var loadOffered = consideredTrainings.Sum(c => c.OfferedLoad);
            var loadReceived = consideredTrainings.Sum(c => c.ReceivedLoad);
            // Si el equipo ofrecio entrenos en la ventana pero el jugador no tiene ninguno computable
            // (todos excluidos), el componente es 0: no se renormaliza el peso al otro bloque.
            double? trainingComponent = loadOffered > 0
                ? loadReceived / loadOffered * 100d
                : (trainingsInWindow.Count > 0 ? 0d : null);

            // ── Partidos ──
            var matchesInWindow = matches.Where(m => m.DaysAgo <= WindowDays).ToList();
            var excludedMatches = matchesInWindow.Count(m => m.Outcome == ParticipationOutcome.Excluded && m.MinutesPlayed <= 0);
            var consideredMatches = matchesInWindow
                .Where(m => m.MinutesPlayed > 0 || m.Outcome != ParticipationOutcome.Excluded)
                .Select(m =>
                {
                    var r = FormStatusRecency.Weight(m.DaysAgo);
                    var (ratio, status) = m.MinutesPlayed > 0
                        ? (Math.Min(1d, m.MinutesPlayed / fullMatchMinutes), MatchStatusPlayed)
                        : m.Outcome == ParticipationOutcome.Absent
                            ? (0d, MatchStatusAbsent)
                            : (0d, MatchStatusNotPlayed);
                    return new ConsideredMatch(
                        m.EventId, m.EventDate, m.EventTypeId, m.DaysAgo, r, m.MinutesPlayed, fullMatchMinutes,
                        ratio, ratio * r, status);
                })
                .OrderByDescending(c => c.EventDate)
                .ThenBy(c => c.DaysAgo)
                .ToArray();

            var recencySum = consideredMatches.Sum(c => c.RecencyWeight);
            var ratioWeightedSum = consideredMatches.Sum(c => c.Contribution);
            // Idem: si el equipo jugo partidos en la ventana y el jugador no tiene ninguno computable,
            // el componente es 0; solo se renormaliza cuando el equipo no jugo ninguno.
            double? matchComponent = recencySum > 0
                ? ratioWeightedSum / recencySum * 100d
                : (matchesInWindow.Count > 0 ? 0d : null);

            // Sin ningun dato computable en ninguno de los bloques no hay estado de forma (null).
            if (loadOffered <= 0 && recencySum <= 0)
            {
                trainingComponent = null;
                matchComponent = null;
            }

            // ── Factor de volumen de entrenos (Decisión 12) ──
            // 100% exige haber asistido a las sesiones de referencia; por debajo el bloque escala
            // proporcionalmente. Un bloque ausente (null) no lleva factor ni se renormaliza.
            var trainingRatioComponent = trainingComponent;
            var minutesPlayedTotal = consideredMatches.Sum(c => c.MinutesPlayed);
            var possibleTotal = consideredMatches.Length * categoryMatchMinutes;
            double? trainingVolumeFactor = trainingComponent is null
                ? null
                : Math.Min(1d, consideredTrainings.Count(c => c.Attended) / (double)ReferenceTrainingSessions);
            trainingComponent = trainingRatioComponent * trainingVolumeFactor;

            // ── Combinación ──
            var factor = 1d - fatigue / 200d;
            double wT, wM;
            if (trainingComponent is not null && matchComponent is not null) { wT = TrainingWeightNominal; wM = MatchWeightNominal; }
            else if (trainingComponent is not null) { wT = 1d; wM = 0d; }
            else if (matchComponent is not null) { wT = 0d; wM = 1d; }
            else { wT = 0d; wM = 0d; }

            var baseScore = wT * (trainingComponent ?? 0d) + wM * (matchComponent ?? 0d);
            int? formStatus = trainingComponent is null && matchComponent is null
                ? null
                : Math.Clamp((int)Math.Round(baseScore * factor, MidpointRounding.AwayFromZero), 0, 100);

            return new Result(
                formStatus,
                trainingComponent,
                consideredTrainings.Length,
                consideredTrainings.Count(c => c.Attended),
                loadOffered,
                loadReceived,
                fallbackUsed,
                excludedTrainings,
                matchComponent,
                consideredMatches.Length,
                categoryMatchMinutes,
                FullStimulusFraction,
                fullMatchMinutes,
                recencySum,
                ratioWeightedSum,
                excludedMatches,
                TrainingWeightNominal,
                MatchWeightNominal,
                wT,
                wM,
                baseScore,
                fatigue,
                factor,
                ReferenceTrainingSessions,
                trainingRatioComponent,
                trainingVolumeFactor,
                minutesPlayedTotal,
                possibleTotal,
                consideredTrainings,
                consideredMatches);
        }
    }
}
