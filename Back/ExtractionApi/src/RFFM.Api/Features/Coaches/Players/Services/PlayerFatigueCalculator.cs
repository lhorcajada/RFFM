namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Pure, side-effect-free calculator for a player's "Cansancio" (Fatigue, 0-100), derived
    /// from recent training attendance (40% weight) and match minutes (60% weight), each event
    /// weighted by an exponential recency decay (2-day half-life) instead of a flat "inside the
    /// window or not" count. No EF/DB access — the handler projects raw events into
    /// (daysAgo[, minutesPlayed]) lists and calls <see cref="Calculate"/>.
    ///
    /// Replaces both the old persisted/incremental TeamPlayerCondition.Fatigue model (always
    /// converged to 0) and the first derived version (flat 7-day window sum, which instead got
    /// permanently stuck at 100 for any player with a normal week of commitment — 2 trainings +
    /// a full match — regardless of how long ago those events happened, because a flat count
    /// cannot distinguish "just trained" from "trained 6 days ago". See
    /// openspec/changes/player-fatigue-recency-decay/design.md for the full numeric example
    /// that exposed the bug and the decay-based fix.
    /// </summary>
    public static class PlayerFatigueCalculator
    {
        // Data-loading cutoff only: how far back the handler queries convocations/match
        // participations to build the event lists passed into Calculate. This is NOT an
        // all-or-nothing saturation window anymore (that was the bug) — recency decay does the
        // actual weighting via HalfLifeDays, so this just needs to be wide enough that events
        // older than it are already decayed to ~0 (decay(14 days) ≈ 0.008, negligible).
        // Widened from the original flat 7-day window precisely so decay has room to act
        // instead of hard-cutting at 7 days like a step function.
        public const int WindowDays = 14;

        // Half-life of an event's contribution to Cansancio: 2 days. A training/match played
        // today contributes at full weight (decay = 1); one played 2 days ago contributes at
        // half weight; 4 days ago at a quarter; etc. Confirmed with the user against a real
        // production case ("Lucas") where the flat-window model pinned Fatigue at 100% despite
        // the player having had multiple rest days since his last training/match.
        public const double HalfLifeDays = 2.0;

        public const int ReferenceTrainingsPerWindow = 2;  // real cadence: trains Tuesday and Thursday
        public const int ReferenceMatchMinutes = 70;        // same reference as PlayerReadinessCalculator

        // Cansancio weighs match load higher than Rodaje's 70/30 training/match split: per
        // minute, a match is materially more taxing than a training session (~2.5x, based on a
        // ~90-minute training session vs a 70-minute reference match reaching their respective
        // components' 100%). See design.md (player-fatigue-derived-window) → Decisión 2 for the
        // full reasoning; a judgment call confirmed against worked examples, not a value the
        // user pinned down numerically.
        public const double TrainingWeight = 0.40;
        public const double MatchWeight = 0.60;

        // Pesos por tipo de entrenamiento para Cansancio: un entreno físico (series, sprints,
        // resistencia) genera más fatiga muscular real que uno táctico (posicionamiento,
        // intensidad media) o uno técnico (control/pase/finalización, intensidad baja-media).
        // Técnico se separa claramente de Táctico porque el trabajo técnico puro suele ser el de
        // menor exigencia física de los tres. Judgment call sin dato fisiológico exacto, igual
        // que HalfLifeDays/TrainingWeight arriba — ver design.md (player-form-status-training-
        // match-weighting) → Decisión 1. Sesión sin tipos marcados usa TrainingTypeWeighting.
        // UntypedWeight (1.00), preservando el comportamiento pre-change.
        private static readonly IReadOnlyDictionary<string, double> FatigueTrainingWeights = new Dictionary<string, double>
        {
            [Domain.Aggregates.Assistances.TrainingType.Fisico.Code] = 1.00,
            [Domain.Aggregates.Assistances.TrainingType.Tactico.Code] = 0.70,
            [Domain.Aggregates.Assistances.TrainingType.Tecnico.Code] = 0.40,
        };

        public record Result(
            int Fatigue,                  // 0-100, always has a value (0 when no events)
            double TrainingComponent,     // 0-100
            double MatchComponent,        // 0-100
            double DecayedTrainingCount,  // weighted sum of Decay(daysAgo) * training-type weight
            double DecayedMatchMinutes,   // weighted sum of minutesPlayed * Decay(daysAgo) * match-type weight
            // Decisión (transparency addendum, ver design.md → "Transparencia del desglose"):
            // lista de CADA evento realmente considerado en la ventana, con su peso y aportación,
            // para que el frontend pueda mostrar "16/09 · Físico · peso 1.00 → cuenta completo" en
            // lugar del porcentaje agregado ilegible. Ordenada de más reciente a más antiguo.
            ConsideredTraining[] ConsideredTrainings,
            ConsideredMatch[] ConsideredMatches);

        // EventDate es nullable porque SportEvent.EveDateTime lo es (evento sin fecha fijada
        // todavía); un entreno/partido en esa situación nunca debería llegar aquí (el handler
        // solo alimenta eventos con fecha dentro de la ventana), pero se mantiene nullable para
        // no forzar una aserción que no aporta valor — el frontend simplemente no muestra fecha.
        public record ConsideredTraining(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            int DaysAgo, double Decay, double TypeWeight, double Contribution);

        public record ConsideredMatch(
            string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
            int DaysAgo, double Decay, double TypeWeight, double EffectiveMinutes);

        /// <summary>
        /// Exponential recency decay: a fixed weight of 1 for an event happening "today"
        /// (daysAgo = 0), halving every <see cref="HalfLifeDays"/> days since it happened.
        /// </summary>
        private static double Decay(int daysAgo) => Math.Pow(0.5, daysAgo / HalfLifeDays);

        public static Result Calculate(
            IReadOnlyList<(string EventId, DateTime? EventDate, int DaysAgo, IReadOnlyList<string> TrainingTypes)> trainings,
            IReadOnlyList<(string EventId, DateTime? EventDate, int DaysAgo, int MinutesPlayed, int EventTypeId)> matches)
        {
            var consideredTrainings = trainings
                .Select(t =>
                {
                    var decay = Decay(t.DaysAgo);
                    var typeWeight = TrainingTypeWeighting.Weight(t.TrainingTypes, FatigueTrainingWeights);
                    return new ConsideredTraining(t.EventId, t.EventDate, t.TrainingTypes, t.DaysAgo, decay, typeWeight, decay * typeWeight);
                })
                .OrderByDescending(c => c.EventDate)
                .ToArray();
            var decayedTrainingCount = consideredTrainings.Sum(c => c.Contribution);

            var consideredMatches = matches
                .Select(m =>
                {
                    var decay = Decay(m.DaysAgo);
                    var typeWeight = MatchTypeWeighting.Weight(m.EventTypeId);
                    return new ConsideredMatch(m.EventId, m.EventDate, m.EventTypeId, m.MinutesPlayed, m.DaysAgo, decay, typeWeight, m.MinutesPlayed * decay * typeWeight);
                })
                .OrderByDescending(c => c.EventDate)
                .ToArray();
            var decayedMatchMinutes = consideredMatches.Sum(c => c.EffectiveMinutes);

            var trainingComponent = Math.Min(100d, decayedTrainingCount / ReferenceTrainingsPerWindow * 100d);
            var matchComponent = Math.Min(100d, decayedMatchMinutes / ReferenceMatchMinutes * 100d);

            var fatigue = (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);

            return new Result(fatigue, trainingComponent, matchComponent, decayedTrainingCount, decayedMatchMinutes, consideredTrainings, consideredMatches);
        }
    }
}
