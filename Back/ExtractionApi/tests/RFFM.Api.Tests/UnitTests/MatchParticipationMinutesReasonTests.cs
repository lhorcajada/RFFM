#nullable enable
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Pure domain tests for MatchParticipation.SetMinutesReason — the free-text, optional
    /// field used to explain why a player played fewer minutes than other participating
    /// players (design.md, add-match-minutes-reason-note). Also asserts Update(...) never
    /// touches this field, since SaveMatchParticipation re-saves the full live-match state
    /// repeatedly and must not silently wipe a reason set through the dedicated endpoint.
    /// </summary>
    public class MatchParticipationMinutesReasonTests
    {
        private static MatchParticipation CreateParticipation() => MatchParticipation.Create(
            eventId: "event-1",
            teamId: "team-1",
            teamPlayerId: "player-1",
            minutesPlayed: 30,
            isStarter: true,
            enteredAtMinute: 0,
            exitedAtMinute: 30,
            scoreLocal: 1,
            scoreVisitor: 0,
            matchPhase: "finished",
            substitutionWindowsJson: null,
            ratingSnapshotsJson: null,
            goalsJson: null);

        [Fact]
        public void SetMinutesReason_WithText_SetsTrimmedValue()
        {
            var participation = CreateParticipation();

            participation.SetMinutesReason("  Decisión técnica: rotación de porteros  ");

            Assert.Equal("Decisión técnica: rotación de porteros", participation.MinutesReason);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void SetMinutesReason_WithBlankValue_ClearsField(string? blank)
        {
            var participation = CreateParticipation();
            participation.SetMinutesReason("Motivo inicial");

            participation.SetMinutesReason(blank);

            Assert.Null(participation.MinutesReason);
        }

        [Fact]
        public void SetMinutesReason_ExceedingMaxLength_Throws()
        {
            var participation = CreateParticipation();
            var tooLong = new string('a', 501);

            Assert.Throws<ArgumentException>(() => participation.SetMinutesReason(tooLong));
        }

        [Fact]
        public void NewParticipation_HasNoMinutesReasonByDefault()
        {
            var participation = CreateParticipation();

            Assert.Null(participation.MinutesReason);
        }

        [Fact]
        public void Update_NeverTouchesPreviouslySetMinutesReason()
        {
            var participation = CreateParticipation();
            participation.SetMinutesReason("Rotación planificada");

            participation.Update(
                minutesPlayed: 45,
                isStarter: true,
                enteredAtMinute: 0,
                exitedAtMinute: 45,
                scoreLocal: 2,
                scoreVisitor: 1,
                matchPhase: "finished",
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: null);

            Assert.Equal("Rotación planificada", participation.MinutesReason);
        }
    }
}
