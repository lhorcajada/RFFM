#nullable enable
using System;
using System.Linq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerSessionEvaluationTests
    {
        private static readonly DateOnly SessionDate = new(2026, 10, 14);
        private static readonly DateOnly Today = new(2026, 10, 20);
        private static readonly SessionSnapshot Session = new("ses-1", "10. Desorganizar rival", SessionDate);

        private static SubprincipioEvaluationInput Item(string id, string label, ObservationAssessment? assessment = null, string? comment = null) =>
            new(new SubprincipioSnapshot(id, "Ataque organizado", "2. Ataque posicional", label),
                assessment ?? ObservationAssessment.NotAchieved, comment);

        private static PlayerSessionEvaluation Create(params SubprincipioEvaluationInput[] items) =>
            PlayerSessionEvaluation.Create("team-1", "tp-1", Session, items, "coach-1", Today);

        [Fact]
        public void Create_StoresSessionSnapshotAndEvaluations()
        {
            var evaluation = Create(Item("sub-23", "2.3 Circular para desordenar", comment: "  Busca el pase vertical  "));

            Assert.Equal("team-1", evaluation.TeamId);
            Assert.Equal("tp-1", evaluation.TeamPlayerId);
            Assert.Equal("ses-1", evaluation.TrainingSessionId);
            Assert.Equal("10. Desorganizar rival", evaluation.SessionName);
            Assert.Equal(SessionDate, evaluation.SessionDate);
            Assert.Equal("coach-1", evaluation.CreatedByUserId);
            var item = Assert.Single(evaluation.Subprincipios);
            Assert.Equal("sub-23", item.SubprincipioId);
            Assert.Equal("Ataque organizado", item.MomentName);
            Assert.Equal("2. Ataque posicional", item.PrincipleLabel);
            Assert.Equal("2.3 Circular para desordenar", item.SubprincipioLabel);
            Assert.Equal(ObservationAssessment.NotAchieved, item.Assessment);
            Assert.Equal("Busca el pase vertical", item.Comment);
        }

        [Fact]
        public void Create_WithoutEvaluations_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => Create());
            Assert.Equal(ErrorCodes.SessionEvaluationEmpty, ex.Code);
        }

        [Fact]
        public void Create_WithRepeatedSubprincipio_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => Create(Item("sub-23", "2.3"), Item("sub-23", "2.3")));
            Assert.Equal(ErrorCodes.SessionEvaluationDuplicatedSubprincipio, ex.Code);
        }

        [Fact]
        public void Create_ForSessionAfterToday_Throws()
        {
            var future = Session with { Date = Today.AddDays(1) };

            var ex = Assert.Throws<DomainException>(() =>
                PlayerSessionEvaluation.Create("team-1", "tp-1", future, new[] { Item("sub-23", "2.3") }, "coach-1", Today));
            Assert.Equal(ErrorCodes.SessionNotHeldYet, ex.Code);
        }

        [Fact]
        public void Create_ForSessionOnToday_IsAllowed()
        {
            var todaySession = Session with { Date = Today };

            var evaluation = PlayerSessionEvaluation.Create("team-1", "tp-1", todaySession, new[] { Item("sub-23", "2.3") }, "coach-1", Today);

            Assert.Equal(Today, evaluation.SessionDate);
        }

        [Fact]
        public void Create_WithCommentLongerThanMax_Throws()
        {
            Assert.Throws<ArgumentException>(() => Create(Item("sub-23", "2.3", comment: new string('a', 501))));
        }

        [Fact]
        public void ReplaceEvaluations_ReplacesTheWholeListAndUpdatesTimestamp()
        {
            var evaluation = Create(Item("sub-23", "2.3"), Item("sub-41", "4.1"));
            var before = evaluation.UpdatedAt;

            evaluation.ReplaceEvaluations(new[] { Item("sub-41", "4.1", ObservationAssessment.Achieved) }, Today);

            var item = Assert.Single(evaluation.Subprincipios);
            Assert.Equal("sub-41", item.SubprincipioId);
            Assert.Equal(ObservationAssessment.Achieved, item.Assessment);
            Assert.True(evaluation.UpdatedAt >= before);
        }

        [Fact]
        public void ReplaceEvaluations_WithoutEvaluations_Throws()
        {
            var evaluation = Create(Item("sub-23", "2.3"));

            var ex = Assert.Throws<DomainException>(() => evaluation.ReplaceEvaluations(Enumerable.Empty<SubprincipioEvaluationInput>(), Today));
            Assert.Equal(ErrorCodes.SessionEvaluationEmpty, ex.Code);
        }
    }
}
