using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;
using Rows = RFFM.Api.Features.Coaches.Players.Services.PlayerLoadInputsBuilder;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerPhysicalEvolutionCalculatorTests
    {
        private static readonly DateTime Now = new(2026, 9, 24, 18, 0, 0, DateTimeKind.Utc);
        private static readonly DateTime Today = Now.Date;
        private const int CadeteHalfMinutes = 40;
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;

        private static Rows.TrainingConvocationRow Training(int daysAgo) =>
            new($"t{daysAgo}", Today.AddDays(-daysAgo).AddHours(19), new[] { "Fisico" }, AssistanceType.Attendance.Id, null, null);

        private static PlayerPhysicalEvolutionCalculator.PlayerLoadRows Load(
            Rows.TrainingConvocationRow[]? trainings = null, (int DaysAgo, int Minutes)[]? matches = null)
        {
            var played = (matches ?? Array.Empty<(int, int)>())
                .Select(m => new Rows.MatchParticipationRow($"m{m.DaysAgo}", Today.AddDays(-m.DaysAgo).AddHours(11), MatchEventTypeId, m.Minutes))
                .ToList();
            return new PlayerPhysicalEvolutionCalculator.PlayerLoadRows(
                trainings ?? Array.Empty<Rows.TrainingConvocationRow>(),
                played.Select(p => new Rows.TeamMatchRow(p.EventId, p.Date, p.EventTypeId)).ToList(),
                played.ToDictionary(p => p.EventId, p => p.MinutesPlayed),
                new Dictionary<string, Rows.MatchConvocationRow>(),
                played,
                Today.AddDays(-200),
                null);
        }

        private static IReadOnlyList<PlayerPhysicalEvolutionCalculator.Point> Calc(
            PlayerPhysicalEvolutionCalculator.PlayerLoadRows rows, int days = 28, int? halfMinutes = CadeteHalfMinutes) =>
            PlayerPhysicalEvolutionCalculator.Calculate(rows, Now, days, halfMinutes);

        [Fact]
        public void ReturnsOnePointPerDay_OldestFirst_EndingToday()
        {
            var points = Calc(Load(), days: 56);

            Assert.Equal(56, points.Count);
            Assert.Equal(Today.AddDays(-55), points[0].Date);
            Assert.Equal(Today, points[^1].Date);
        }

        [Fact]
        public void LastPoint_EqualsTheCurrentCalculators()
        {
            var rows = Load(new[] { Training(1), Training(3), Training(8) }, new[] { (2, 60), (9, 70) });

            var last = Calc(rows)[^1];

            var trainings = Rows.Trainings(rows.Trainings, Now);
            var matches = Rows.Matches(rows.TeamMatches, rows.MinutesByEvent, rows.MatchConvocations, rows.JoinedDate, rows.LeftDate, Now);
            var start = Today.AddDays(-(DailyLoadModel.ReplayDays - 1));
            Assert.Equal(PlayerFormStatusCalculator.Calculate(trainings, matches, start, Today, CadeteHalfMinutes).Value, last.FormStatus);
            Assert.Equal(PlayerReadinessCalculator.Calculate(trainings, matches, start, Today).Value, last.Readiness);
            Assert.Equal(PlayerFatigueCalculator.Calculate(Rows.FatigueTrainings(rows.Trainings, Now), Rows.FatigueMatches(rows.Participations, Now)).Fatigue, last.Fatigue);
        }

        [Fact]
        public void AnEvent_OnlyAffectsPointsFromItsDayOnwards()
        {
            var points = Calc(Load(new[] { Training(5) }));

            var dayBefore = points.Single(p => p.Date == Today.AddDays(-6));
            var trainingDay = points.Single(p => p.Date == Today.AddDays(-5));
            Assert.Null(dayBefore.Readiness);
            Assert.Equal(0, dayBefore.Fatigue);
            Assert.NotNull(trainingDay.Readiness);
            Assert.True(trainingDay.Fatigue > 0);
        }

        [Fact]
        public void WithoutActivity_PointsAreNullNullZero()
        {
            var points = Calc(Load());

            Assert.All(points, p =>
            {
                Assert.Null(p.FormStatus);
                Assert.Null(p.Readiness);
                Assert.Equal(0, p.Fatigue);
            });
        }

        [Fact]
        public void WithoutCategoryMinutes_FormStatusIsAlwaysNull()
        {
            var points = Calc(Load(new[] { Training(1) }), halfMinutes: null);

            Assert.All(points, p => Assert.Null(p.FormStatus));
            Assert.NotNull(points[^1].Readiness);
        }

        [Fact]
        public void PastDays_AreClosedAsRestDays()
        {
            var rows = Load(Enumerable.Range(10, 60).Select(Training).ToArray());
            var day = Today.AddDays(-4);

            var point = Calc(rows).Single(p => p.Date == day);

            var asOf = day.AddDays(1).AddTicks(-1);
            var expected = PlayerFormStatusCalculator.Calculate(
                Rows.Trainings(rows.Trainings, asOf), Array.Empty<DailyLoadModel.MatchInput>(),
                day.AddDays(-(DailyLoadModel.ReplayDays - 1)), day, CadeteHalfMinutes, todayIsClosed: true);
            Assert.Equal(expected.Value, point.FormStatus);
            Assert.True(point.FormStatus < Calc(rows).Single(p => p.Date == Today.AddDays(-9)).FormStatus);
        }
    }
}
