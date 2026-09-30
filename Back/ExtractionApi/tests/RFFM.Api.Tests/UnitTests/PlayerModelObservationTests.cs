#nullable enable
using System;
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerModelObservationTests
    {
        private static readonly DateOnly Date = new(2026, 10, 14);

        private static readonly SubprincipioSnapshot Snapshot =
            new("sub-1", "Ataque organizado", "2. Ataque posicional", "2.3 Circular para desordenar");

        private static PlayerModelObservation Create(
            string teamPlayerId = "tp-1",
            string teamId = "team-1",
            SubprincipioSnapshot? snapshot = null,
            string? comment = "Busca siempre el pase vertical",
            string createdBy = "coach-1") =>
            PlayerModelObservation.ForGameModel(
                teamPlayerId, teamId, Date, snapshot ?? Snapshot, ObservationAssessment.NotAchieved, comment, createdBy);

        [Fact]
        public void ForGameModel_ValidInput_StoresObservationWithSnapshot()
        {
            var observation = Create();

            Assert.Equal("tp-1", observation.TeamPlayerId);
            Assert.Equal("team-1", observation.TeamId);
            Assert.Equal(Date, observation.Date);
            Assert.Equal(ObservationKind.GameModel, observation.Kind);
            Assert.Equal("sub-1", observation.SubprincipioId);
            Assert.Equal("Ataque organizado", observation.MomentName);
            Assert.Equal("2. Ataque posicional", observation.PrincipleLabel);
            Assert.Equal("2.3 Circular para desordenar", observation.SubprincipioLabel);
            Assert.Equal(ObservationAssessment.NotAchieved, observation.Assessment);
            Assert.Equal("Busca siempre el pase vertical", observation.Comment);
            Assert.Equal("coach-1", observation.CreatedByUserId);
        }

        [Fact]
        public void ForGameModel_LeavesColumnsOfLaterDeliveriesEmpty()
        {
            var observation = Create();

            Assert.Null(observation.AttitudeKey);
            Assert.Empty(observation.Habilidades);
            Assert.Null(observation.TrainingSessionId);
        }

        [Theory]
        [InlineData("", "team-1", "coach-1")]
        [InlineData("tp-1", " ", "coach-1")]
        [InlineData("tp-1", "team-1", "")]
        public void ForGameModel_MissingIds_Throws(string teamPlayerId, string teamId, string createdBy)
        {
            Assert.Throws<ArgumentException>(() => Create(teamPlayerId, teamId, createdBy: createdBy));
        }

        [Theory]
        [InlineData("", "Fase", "Principio", "Subprincipio")]
        [InlineData("sub-1", " ", "Principio", "Subprincipio")]
        [InlineData("sub-1", "Fase", "", "Subprincipio")]
        [InlineData("sub-1", "Fase", "Principio", " ")]
        public void ForGameModel_IncompleteSnapshot_Throws(string id, string moment, string principle, string subprincipio)
        {
            Assert.Throws<ArgumentException>(() => Create(snapshot: new SubprincipioSnapshot(id, moment, principle, subprincipio)));
        }

        [Fact]
        public void ForGameModel_CommentLongerThanMax_Throws()
        {
            var comment = new string('a', PlayerModelObservation.Rules.CommentMaxLength + 1);

            Assert.Throws<ArgumentException>(() => Create(comment: comment));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void ForGameModel_BlankComment_IsStoredAsNull(string? comment)
        {
            Assert.Null(Create(comment: comment).Comment);
        }

        [Fact]
        public void ForGameModel_TrimsComment()
        {
            Assert.Equal("No asegura tras robo", Create(comment: "  No asegura tras robo  ").Comment);
        }
    }
}
