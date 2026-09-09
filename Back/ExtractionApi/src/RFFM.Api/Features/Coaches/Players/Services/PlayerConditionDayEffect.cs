namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Pure, side-effect-free calculator for the daily effect on a player's Forma física
    /// (fitness) and Cansancio (fatigue), derived from what happened on a given day: training
    /// attendance, match minutes played, injury absence, or rest (default). No EF/DB access —
    /// <see cref="Domain.Entities.TeamPlayers.TeamPlayerCondition"/> clamps and persists the
    /// result; this class only computes deltas.
    /// See openspec/changes/player-physical-condition-fatigue/design.md → Decisión 2.
    /// </summary>
    public static class PlayerConditionDayEffect
    {
        public const double InitialFitness = 30;
        public const double InitialFatigue = 20;

        public const double TrainingFitnessDelta = 3;
        public const double TrainingFatigueDelta = 5;

        public const double ReferenceMatchMinutes = 70; // mismo valor de referencia que Rodaje
        public const double FullMatchFitnessDelta = 2;
        public const double FullMatchFatigueDelta = 10;

        public const double RestFitnessDelta = -2;
        public const double RestFatigueDelta = -2; // bajado de -6: con 2-3 entrenos/semana el
        // descanso recuperaba más rápido de lo que costaba entrenar y el cansancio caía a 0
        // siempre entre sesiones — confirmado con el usuario (2026-09-09).

        public const double InjuryRestFitnessDelta = -4;
        public const double InjuryRestFatigueDelta = -2; // igual que descanso normal

        public enum DayOutcome { Rest, InjuryAbsence, Training, Match }

        public readonly record struct DayEvent(DayOutcome Outcome, int MatchMinutesPlayed = 0);

        public static (double FitnessDelta, double FatigueDelta) Calculate(DayEvent day) => day.Outcome switch
        {
            DayOutcome.Training => (TrainingFitnessDelta, TrainingFatigueDelta),
            DayOutcome.Match => MatchDelta(day.MatchMinutesPlayed),
            DayOutcome.InjuryAbsence => (InjuryRestFitnessDelta, InjuryRestFatigueDelta),
            _ => (RestFitnessDelta, RestFatigueDelta),
        };

        private static (double, double) MatchDelta(int minutesPlayed)
        {
            var factor = Math.Min(1.0, Math.Max(0.0, minutesPlayed) / ReferenceMatchMinutes);
            return (FullMatchFitnessDelta * factor, FullMatchFatigueDelta * factor);
        }
    }
}
