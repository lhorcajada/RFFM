using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// "Estado de forma" (0-100 o null) sobre <see cref="DailyLoadModel"/>: cada entreno o partido
    /// lo sube, se mantiene hasta 4 días seguidos sin actividad y a partir del 5º baja cada día un
    /// poco más. No depende de Cansancio ni de Rodaje; el motivo de una falta no cambia el valor.
    /// See openspec/changes/player-form-readiness-daily-load-model/design.md → Decisiones 1-3.
    /// </summary>
    public static class PlayerFormStatusCalculator
    {
        public static readonly DailyLoadModel.Parameters Parameters = new(
            GainRate: 0.16, GraceRestDays: 4, DecayStepPerDay: 0.5, DecayMaxPerDay: 3);

        // 87.5% de la duración del partido = "estímulo completo" (Cadete: 70 de 80 minutos).
        public const double FullStimulusFraction = 0.875;

        // Estado de forma mide condición física: el físico manda, el táctico aporta algo de carga
        // de movimiento y el técnico no mejora la condición física (mantiene, no suma).
        private static readonly IReadOnlyDictionary<string, double> FormStatusTrainingWeights = new Dictionary<string, double>
        {
            [TrainingType.Fisico.Code] = 1.00,
            [TrainingType.Tactico.Code] = 0.50,
            [TrainingType.Tecnico.Code] = 0.00,
        };

        /// <param name="categoryHalfMinutes">Minutos de CADA PARTE (MatchDurationMinutesByCategory).</param>
        public static DailyLoadModel.MetricResult Calculate(
            IReadOnlyList<DailyLoadModel.TrainingInput> trainings,
            IReadOnlyList<DailyLoadModel.MatchInput> matches,
            DateTime startDate,
            DateTime today,
            int categoryHalfMinutes) =>
            DailyLoadModel.Evaluate(
                trainings, matches, SportEventType.FromName("Entrenamiento").Id, startDate, today, Parameters,
                types => TrainingTypeWeighting.Weight(types, FormStatusTrainingWeights),
                _ => 1d,
                FullStimulusFraction * 2 * categoryHalfMinutes);
    }
}
