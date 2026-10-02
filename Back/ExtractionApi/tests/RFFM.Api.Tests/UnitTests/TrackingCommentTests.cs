#nullable enable
using System;
using System.Linq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TrackingCommentTests
    {
        [Fact]
        public void Create_TrimsTitleAndDescription()
        {
            var comment = TrackingComment.Create("team-1", "  Implicación defensiva  ", "  Ayuda en las tareas sin balón  ", "coach-1");

            Assert.Equal("team-1", comment.TeamId);
            Assert.Equal("Implicación defensiva", comment.Title);
            Assert.Equal("Ayuda en las tareas sin balón", comment.Description);
            Assert.Equal("coach-1", comment.CreatedByUserId);
        }

        [Fact]
        public void Create_BlankDescription_IsStoredAsNull()
        {
            Assert.Null(TrackingComment.Create("team-1", "Paciencia", "   ", "coach-1").Description);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_WithoutTitle_Throws(string title)
        {
            Assert.Throws<ArgumentException>(() => TrackingComment.Create("team-1", title, null, "coach-1"));
        }

        [Fact]
        public void Create_TooLongTitleOrDescription_Throws()
        {
            Assert.Throws<ArgumentException>(() => TrackingComment.Create("team-1", new string('a', 101), null, "coach-1"));
            Assert.Throws<ArgumentException>(() => TrackingComment.Create("team-1", "Paciencia", new string('a', 501), "coach-1"));
        }
    }

    public class PlayerSessionEvaluationCommentsTests
    {
        private static readonly DateOnly Today = new(2026, 10, 20);
        private static readonly SessionSnapshot Session = new("ses-1", "10. Desorganizar rival", new DateOnly(2026, 10, 14));

        private static CommentEvaluationInput Comment(string id, string title, ObservationAssessment? assessment = null, string? note = null) =>
            new(id, title, assessment ?? ObservationAssessment.NotAchieved, note);

        private static SubprincipioEvaluationInput Item() =>
            new(new SubprincipioSnapshot("sub-23", "Ataque organizado", "2. Ataque posicional", "2.3"), ObservationAssessment.Partial, null);

        [Fact]
        public void Create_WithOnlyComments_StoresThemWithTitleAndNote()
        {
            var evaluation = PlayerSessionEvaluation.Create(
                "team-1", "tp-1", Session, Enumerable.Empty<SubprincipioEvaluationInput>(), "coach-1", Today,
                new[] { Comment("tc-1", "Implicación defensiva", note: "  Pregunta si vamos a hacer eso todo el entreno  ") });

            Assert.Empty(evaluation.Subprincipios);
            var comment = Assert.Single(evaluation.Comments);
            Assert.Equal("tc-1", comment.TrackingCommentId);
            Assert.Equal("Implicación defensiva", comment.Title);
            Assert.Equal(ObservationAssessment.NotAchieved, comment.Assessment);
            Assert.Equal("Pregunta si vamos a hacer eso todo el entreno", comment.Note);
        }

        [Fact]
        public void Create_WithoutSubprincipiosNorComments_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => PlayerSessionEvaluation.Create(
                "team-1", "tp-1", Session, Enumerable.Empty<SubprincipioEvaluationInput>(), "coach-1", Today,
                Enumerable.Empty<CommentEvaluationInput>()));

            Assert.Equal(ErrorCodes.SessionEvaluationEmpty, ex.Code);
        }

        [Fact]
        public void Create_WithRepeatedComment_Throws()
        {
            var ex = Assert.Throws<DomainException>(() => PlayerSessionEvaluation.Create(
                "team-1", "tp-1", Session, new[] { Item() }, "coach-1", Today,
                new[] { Comment("tc-1", "Implicación defensiva"), Comment("tc-1", "Implicación defensiva") }));

            Assert.Equal(ErrorCodes.SessionEvaluationDuplicatedComment, ex.Code);
        }

        [Fact]
        public void Create_WithNoteLongerThanMax_Throws()
        {
            Assert.Throws<ArgumentException>(() => PlayerSessionEvaluation.Create(
                "team-1", "tp-1", Session, new[] { Item() }, "coach-1", Today,
                new[] { Comment("tc-1", "Implicación defensiva", note: new string('a', 501)) }));
        }

        [Fact]
        public void ReplaceEvaluations_ReplacesSubprincipiosAndComments()
        {
            var evaluation = PlayerSessionEvaluation.Create(
                "team-1", "tp-1", Session, new[] { Item() }, "coach-1", Today, new[] { Comment("tc-1", "Implicación defensiva") });

            evaluation.ReplaceEvaluations(Enumerable.Empty<SubprincipioEvaluationInput>(), Today,
                new[] { Comment("tc-2", "Paciencia con balón", ObservationAssessment.Achieved) });

            Assert.Empty(evaluation.Subprincipios);
            var comment = Assert.Single(evaluation.Comments);
            Assert.Equal("tc-2", comment.TrackingCommentId);
            Assert.Equal(ObservationAssessment.Achieved, comment.Assessment);
        }
    }
}
