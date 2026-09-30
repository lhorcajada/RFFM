using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerLoadInputsBuilderTests
    {
        private static readonly DateTime Now = new(2026, 9, 24, 18, 0, 0, DateTimeKind.Utc);
        private static readonly string[] Fisico = { "Fisico" };
        private const int MatchEventTypeId = SportEventsConstants.MatchEventTypeId;

        private static PlayerLoadInputsBuilder.TrainingConvocationRow TrainingRow(
            string id, DateTime date, int? assistanceTypeId = null, int? excuseTypeId = null) =>
            new(id, date, Fisico, assistanceTypeId ?? AssistanceType.Attendance.Id, null, excuseTypeId);

        private static PlayerLoadInputsBuilder.TeamMatchRow TeamMatch(string id, DateTime date) => new(id, date, MatchEventTypeId);

        private static readonly IReadOnlyDictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow> NoConvocations =
            new Dictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow>();

        [Fact]
        public void Trainings_ClassifiesOutcomeAndReason()
        {
            var inputs = PlayerLoadInputsBuilder.Trainings(new[]
            {
                TrainingRow("a", Now.AddDays(-2)),
                TrainingRow("b", Now.AddDays(-1), AssistanceType.UnexcusedAbsence.Id),
            }, Now);

            Assert.Collection(inputs,
                t => { Assert.Equal("a", t.EventId); Assert.Equal(ParticipationOutcome.Attended, t.Outcome); Assert.Equal(Fisico, t.TrainingTypes); },
                t => { Assert.Equal(ParticipationOutcome.Absent, t.Outcome); Assert.Equal(AssistanceType.UnexcusedAbsence.Name, t.Reason); });
        }

        [Fact]
        public void Trainings_AfterAsOf_AreIgnored()
        {
            var inputs = PlayerLoadInputsBuilder.Trainings(new[] { TrainingRow("a", Now.AddDays(-1)), TrainingRow("b", Now.AddHours(1)) }, Now);

            Assert.Equal("a", Assert.Single(inputs).EventId);
        }

        [Fact]
        public void Matches_BeforeJoinedDate_AreIgnoredUnlessThePlayerHasMinutes()
        {
            var joined = Now.AddDays(-10);
            var inputs = PlayerLoadInputsBuilder.Matches(
                new[] { TeamMatch("old", Now.AddDays(-20)), TeamMatch("oldPlayed", Now.AddDays(-15)), TeamMatch("new", Now.AddDays(-3)) },
                new Dictionary<string, int> { ["oldPlayed"] = 30 },
                NoConvocations, joined, null, Now);

            Assert.Equal(new[] { "oldPlayed", "new" }, inputs.Select(m => m.EventId));
            Assert.Equal(30, inputs[0].MinutesPlayed);
        }

        [Fact]
        public void Matches_AfterLeftDateOrAsOf_AreIgnored()
        {
            var inputs = PlayerLoadInputsBuilder.Matches(
                new[] { TeamMatch("in", Now.AddDays(-8)), TeamMatch("afterLeft", Now.AddDays(-2)), TeamMatch("future", Now.AddHours(2)) },
                new Dictionary<string, int>(),
                NoConvocations, Now.AddDays(-30), Now.AddDays(-5), Now);

            Assert.Equal("in", Assert.Single(inputs).EventId);
        }

        [Fact]
        public void Matches_MissedReason_DependsOnTheConvocation()
        {
            var inputs = PlayerLoadInputsBuilder.Matches(
                new[] { TeamMatch("notCalled", Now.AddDays(-9)), TeamMatch("bench", Now.AddDays(-6)), TeamMatch("absent", Now.AddDays(-3)) },
                new Dictionary<string, int>(),
                new Dictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow>
                {
                    ["bench"] = new("bench", AssistanceType.Attendance.Id, null, null),
                    ["absent"] = new("absent", AssistanceType.UnexcusedAbsence.Id, null, null),
                },
                Now.AddDays(-30), null, Now);

            Assert.Equal(new[] { "No convocado", "Convocado sin jugar", AssistanceType.UnexcusedAbsence.Name },
                inputs.Select(m => m.Reason));
        }

        [Fact]
        public void FatigueTrainings_OnlyAttendedInsideTheWindow_WithDaysAgoRelativeToAsOf()
        {
            var asOf = new DateTime(2026, 9, 10, 23, 59, 59, DateTimeKind.Utc);
            var events = PlayerLoadInputsBuilder.FatigueTrainings(new[]
            {
                TrainingRow("attended", asOf.AddDays(-3)),
                TrainingRow("late", asOf.AddDays(-1), AssistanceType.LateArrival.Id),
                TrainingRow("absent", asOf.AddDays(-2), AssistanceType.ExcusedAbsence.Id),
                TrainingRow("tooOld", asOf.AddDays(-15)),
                TrainingRow("later", asOf.AddDays(2)),
            }, asOf);

            Assert.Equal(new[] { ("attended", 3), ("late", 1) }, events.Select(e => (e.EventId, e.DaysAgo)));
        }

        [Fact]
        public void FatigueMatches_OneEntryPerParticipationInsideTheWindow()
        {
            var events = PlayerLoadInputsBuilder.FatigueMatches(new[]
            {
                new PlayerLoadInputsBuilder.MatchParticipationRow("m1", Now.AddDays(-2), MatchEventTypeId, 40),
                new PlayerLoadInputsBuilder.MatchParticipationRow("m1", Now.AddDays(-2), MatchEventTypeId, 20),
                new PlayerLoadInputsBuilder.MatchParticipationRow("old", Now.AddDays(-20), MatchEventTypeId, 70),
                new PlayerLoadInputsBuilder.MatchParticipationRow("next", Now.AddDays(3), MatchEventTypeId, 70),
            }, Now);

            Assert.Equal(new[] { ("m1", 2, 40), ("m1", 2, 20) }, events.Select(e => (e.EventId, e.DaysAgo, e.MinutesPlayed)));
        }
    }
}
