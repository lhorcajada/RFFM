namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Serie diaria de Estado de forma, Rodaje y Cansancio: el punto del día D es lo que darían los
    /// calculadores actuales si hoy fuera D (solo eventos hasta D, misma ventana de reproducción).
    /// Los días pasados se cierran como días completos; el último punto coincide con las
    /// estadísticas de plantilla. See openspec/changes/player-physical-evolution/design.md → D2, D3, D5.
    /// </summary>
    public static class PlayerPhysicalEvolutionCalculator
    {
        public record PlayerLoadRows(
            IReadOnlyList<PlayerLoadInputsBuilder.TrainingConvocationRow> Trainings,
            IReadOnlyList<PlayerLoadInputsBuilder.TeamMatchRow> TeamMatches,
            IReadOnlyDictionary<string, int> MinutesByEvent,
            IReadOnlyDictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow> MatchConvocations,
            IReadOnlyList<PlayerLoadInputsBuilder.MatchParticipationRow> Participations,
            DateTime JoinedDate,
            DateTime? LeftDate);

        public record Point(DateTime Date, int? FormStatus, int? Readiness, int Fatigue);

        /// <param name="categoryHalfMinutes">Minutos de cada parte de la categoría; null = sin Estado de forma.</param>
        public static IReadOnlyList<Point> Calculate(PlayerLoadRows rows, DateTime nowUtc, int days, int? categoryHalfMinutes)
        {
            var today = nowUtc.Date;
            var points = new List<Point>(days);
            for (var day = today.AddDays(-(days - 1)); day <= today; day = day.AddDays(1))
            {
                var isPastDay = day < today;
                var asOf = isPastDay ? day.AddDays(1).AddTicks(-1) : nowUtc;
                var replayStart = day.AddDays(-(DailyLoadModel.ReplayDays - 1));

                var trainings = PlayerLoadInputsBuilder.Trainings(rows.Trainings, asOf);
                var matches = PlayerLoadInputsBuilder.Matches(
                    rows.TeamMatches, rows.MinutesByEvent, rows.MatchConvocations, rows.JoinedDate, rows.LeftDate, asOf);

                var readiness = PlayerReadinessCalculator.Calculate(trainings, matches, replayStart, day, isPastDay).Value;
                var formStatus = categoryHalfMinutes is { } half
                    ? PlayerFormStatusCalculator.Calculate(trainings, matches, replayStart, day, half, isPastDay).Value
                    : null;
                var fatigue = PlayerFatigueCalculator.Calculate(
                    PlayerLoadInputsBuilder.FatigueTrainings(rows.Trainings, asOf),
                    PlayerLoadInputsBuilder.FatigueMatches(rows.Participations, asOf)).Fatigue;

                points.Add(new Point(day, formStatus, readiness, fatigue));
            }
            return points;
        }
    }
}
