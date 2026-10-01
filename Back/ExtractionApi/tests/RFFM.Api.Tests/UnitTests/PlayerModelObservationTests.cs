#nullable enable
using System;
using System.Linq;
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
        public void ForGameModel_WithTrainingSession_StoresIt()
        {
            var observation = PlayerModelObservation.ForGameModel(
                "tp-1", "team-1", Date, Snapshot, ObservationAssessment.Partial, null, "coach-1", trainingSessionId: "ses-1");

            Assert.Equal("ses-1", observation.TrainingSessionId);
        }

        [Theory]
        [InlineData("")]
        [InlineData("  ")]
        public void ForGameModel_BlankTrainingSession_IsStoredAsNull(string trainingSessionId)
        {
            var observation = PlayerModelObservation.ForGameModel(
                "tp-1", "team-1", Date, Snapshot, ObservationAssessment.Partial, null, "coach-1", trainingSessionId);

            Assert.Null(observation.TrainingSessionId);
        }

        [Fact]
        public void Update_ChangesAssessmentAndComment_KeepingDateSubprincipioAndSession()
        {
            var observation = PlayerModelObservation.ForGameModel(
                "tp-1", "team-1", Date, Snapshot, ObservationAssessment.NotAchieved, "Antes", "coach-1", "ses-1");

            observation.Update(ObservationAssessment.Partial, "  Mejora tras la charla  ");

            Assert.Equal(ObservationAssessment.Partial, observation.Assessment);
            Assert.Equal("Mejora tras la charla", observation.Comment);
            Assert.Equal(Date, observation.Date);
            Assert.Equal("sub-1", observation.SubprincipioId);
            Assert.Equal("ses-1", observation.TrainingSessionId);
        }

        [Fact]
        public void Update_BlankComment_IsStoredAsNull()
        {
            var observation = Create();

            observation.Update(ObservationAssessment.Achieved, "   ");

            Assert.Null(observation.Comment);
        }

        [Fact]
        public void Update_CommentLongerThanMax_Throws()
        {
            var observation = Create();

            Assert.Throws<ArgumentException>(() =>
                observation.Update(ObservationAssessment.Achieved, new string('a', PlayerModelObservation.Rules.CommentMaxLength + 1)));
        }

        [Fact]
        public void Update_NullAssessment_Throws()
        {
            var observation = Create();

            Assert.Throws<ArgumentNullException>(() => observation.Update(null!, "comentario"));
        }

        [Fact]
        public void ForAttitude_StoresTraitKindAndSession_WithoutSubprincipio()
        {
            var observation = PlayerModelObservation.ForAttitude(
                "tp-1", "team-1", Date, "defensive-commitment", ObservationAssessment.NotAchieved,
                "Pregunta si vamos a hacer eso todo el entreno", "coach-1", "ses-1");

            Assert.Equal(ObservationKind.Attitude, observation.Kind);
            Assert.Equal("defensive-commitment", observation.AttitudeKey);
            Assert.Equal("ses-1", observation.TrainingSessionId);
            Assert.Null(observation.SubprincipioId);
            Assert.Null(observation.MomentName);
            Assert.Null(observation.PrincipleLabel);
            Assert.Null(observation.SubprincipioLabel);
            Assert.Equal("Pregunta si vamos a hacer eso todo el entreno", observation.Comment);
        }

        [Theory]
        [InlineData("")]
        [InlineData("laziness")]
        public void ForAttitude_UnknownTrait_Throws(string attitudeKey)
        {
            Assert.Throws<ArgumentException>(() => PlayerModelObservation.ForAttitude(
                "tp-1", "team-1", Date, attitudeKey, ObservationAssessment.Partial, null, "coach-1"));
        }

        [Fact]
        public void AttitudeTraits_HasTheSixTraitsInOrder()
        {
            Assert.Equal(
                new[] { "defensive-commitment", "patience", "courage-in-duels", "off-ball-effort", "listening", "focus" },
                AttitudeTraits.All.Select(t => t.Key).ToArray());
            Assert.Equal("Implicación en tareas defensivas", AttitudeTraits.LabelOf("defensive-commitment"));
        }

        [Fact]
        public void ForGameModel_TrimsComment()
        {
            Assert.Equal("No asegura tras robo", Create(comment: "  No asegura tras robo  ").Comment);
        }
    }
}
