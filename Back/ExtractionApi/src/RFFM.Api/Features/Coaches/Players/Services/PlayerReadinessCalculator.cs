using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// "Rodaje" (0-100 o null) sobre <see cref="DailyLoadModel"/>: sube más despacio que el Estado
    /// de forma, se estanca 21 días sin actividad y después baja despacio (máx. 2 puntos/día).
    /// See openspec/changes/player-form-readiness-daily-load-model/design.md → Decisiones 1-3.
    /// </summary>
    public static class PlayerReadinessCalculator
    {
        public static readonly DailyLoadModel.Parameters Parameters = new(
            GainRate: 0.10, GraceRestDays: 21, DecayStepPerDay: 0.25, DecayMaxPerDay: 2);

        public const int ReferenceMatchMinutes = 70;

        // Rodaje mide la soltura competitiva: el táctico (patrones de juego reales) aporta más que
        // el técnico (aislado) y el físico aporta poco (algo de ritmo).
        private static readonly IReadOnlyDictionary<string, double> ReadinessTrainingWeights = new Dictionary<string, double>
        {
            [TrainingType.Fisico.Code] = 0.30,
            [TrainingType.Tactico.Code] = 1.00,
            [TrainingType.Tecnico.Code] = 0.60,
        };

        public static DailyLoadModel.MetricResult Calculate(
            IReadOnlyList<DailyLoadModel.TrainingInput> trainings,
            IReadOnlyList<DailyLoadModel.MatchInput> matches,
            DateTime startDate,
            DateTime today) =>
            DailyLoadModel.Evaluate(
                trainings, matches, SportEventType.FromName("Entrenamiento").Id, startDate, today, Parameters,
                types => TrainingTypeWeighting.Weight(types, ReadinessTrainingWeights),
                MatchTypeWeighting.Weight,
                ReferenceMatchMinutes);
    }
}
