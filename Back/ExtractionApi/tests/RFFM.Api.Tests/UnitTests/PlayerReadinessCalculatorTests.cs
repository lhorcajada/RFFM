using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerReadinessCalculatorTests
    {
        private static readonly DateTime Today = new(2026, 9, 24);
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;
        private const int FriendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId;

        private static DailyLoadModel.TrainingInput Training(
            int daysAgo, string[]? types = null, ParticipationOutcome outcome = ParticipationOutcome.Attended, string? reason = null) =>
            new($"t{daysAgo}", Today.AddDays(-daysAgo), types ?? new[] { "Tactico" }, outcome, reason);

        private static DailyLoadModel.MatchInput Match(int daysAgo, int minutes, int eventTypeId = MatchEventTypeId) =>
            new($"m{daysAgo}", Today.AddDays(-daysAgo), eventTypeId, minutes, null);

        private static DailyLoadModel.MetricResult Calc(
            IReadOnlyList<DailyLoadModel.TrainingInput> trainings,
            IReadOnlyList<DailyLoadModel.MatchInput> matches,
            DateTime? startDate = null) =>
            PlayerReadinessCalculator.Calculate(trainings, matches, startDate ?? Today.AddDays(-83), Today);

        private static readonly DailyLoadModel.TrainingInput[] NoTrainings = Array.Empty<DailyLoadModel.TrainingInput>();
        private static readonly DailyLoadModel.MatchInput[] NoMatches = Array.Empty<DailyLoadModel.MatchInput>();

        [Fact]
        public void WithoutActivityInReplay_ReadinessIsNull()
        {
            var result = Calc(new[] { Training(3, outcome: ParticipationOutcome.Absent) }, NoMatches);

            Assert.Null(result.Value);
            Assert.Null(result.Model);
        }

        [Fact]
        public void TacticoTraining_GivesMoreReadinessThanTecnico()
        {
            var tactico = Calc(new[] { Training(0, new[] { "Tactico" }) }, NoMatches);
            var tecnico = Calc(new[] { Training(0, new[] { "Tecnico" }) }, NoMatches);

            Assert.Equal(10, tactico.Value);
            Assert.Equal(6, tecnico.Value);
        }

        [Theory]
        [InlineData(new[] { "Fisico" }, 0.30)]
        [InlineData(new[] { "Tactico", "Fisico" }, 0.65)]
        [InlineData(new string[0], 1.00)]
        public void TrainingLoad_IsItsReadinessTypeWeight(string[] types, double expectedLoad)
        {
            var result = Calc(new[] { Training(0, types) }, NoMatches);

            Assert.Equal(expectedLoad, result.Model!.Steps.Single().Load, precision: 6);
        }

        [Theory]
        [InlineData(ParticipationOutcome.Absent, "Lesión")]
        [InlineData(ParticipationOutcome.Excluded, "Decisión técnica")]
        public void OnlyRealAttendanceAddsLoad(ParticipationOutcome outcome, string reason)
        {
            var result = Calc(new[] { Training(5), Training(2, outcome: outcome, reason: reason) }, NoMatches);

            Assert.Equal(1, result.TrainingsAttended);
            Assert.Contains(result.MissedEvents, m => m.EventId == "t2" && m.Reason == reason);
        }

        [Fact]
        public void LeagueMatch_WeighsMoreThanFriendlyWithSameMinutes()
        {
            var league = Calc(NoTrainings, new[] { Match(0, 70) });
            var friendly = Calc(NoTrainings, new[] { Match(0, 70, FriendlyEventTypeId) });

            Assert.Equal(14, league.Value);
            Assert.Equal(10, friendly.Value);
        }

        [Fact]
        public void MoreMinutes_NeverGiveLessReadiness()
        {
            DailyLoadModel.MetricResult Run(int a, int b) =>
                Calc(new[] { Training(10), Training(3) }, new[] { Match(8, a), Match(1, b) });

            Assert.True(Run(90, 18).Model!.Value >= Run(70, 36).Model!.Value);
            Assert.True(Run(18, 90).Model!.Value >= Run(36, 70).Model!.Value);
        }

        [Theory]
        [InlineData(21, 100)]
        [InlineData(28, 93)]
        [InlineData(42, 65)]
        [InlineData(56, 37)]
        public void RestDays_KeepReadinessForThreeWeeksAndThenLowerItSlowly(int restDays, int expected)
        {
            var trainings = Enumerable.Range(restDays + 1, 120).Select(d => Training(d)).ToArray();
            var matches = Enumerable.Range(restDays + 1, 120).Select(d => Match(d, 80)).ToArray();

            var result = Calc(trainings, matches, Today.AddDays(-(restDays + 120)));

            Assert.Equal(expected, result.Value);
        }

        [Fact]
        public void ReferenceMatchMinutes_Is70()
        {
            var result = Calc(new[] { Training(0) }, NoMatches);

            Assert.Equal(70d, result.ReferenceMatchMinutes, precision: 6);
        }
    }
}
