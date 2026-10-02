#nullable enable
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.PlayerTracking;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SaveSessionEvaluationValidatorTests
    {
        private static SaveSessionEvaluation.Command Valid() => new()
        {
            TeamId = "team-1",
            TeamPlayerId = "tp-1",
            SessionId = "ses-1",
            Evaluations = new[]
            {
                new SaveSessionEvaluation.EvaluationItem("sub-31", "NotAchieved", "Busca el pase vertical"),
                new SaveSessionEvaluation.EvaluationItem("sub-32", "Partial", null)
            }
        };

        private static bool IsValid(SaveSessionEvaluation.Command command) =>
            new SaveSessionEvaluation.Validator().Validate(command).IsValid;

        [Fact]
        public void Validate_ValidCommand_IsValid()
        {
            Assert.True(IsValid(Valid()));
        }

        [Fact]
        public void Validate_WithoutEvaluationsNorComments_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Evaluations = System.Array.Empty<SaveSessionEvaluation.EvaluationItem>() }));
        }

        [Fact]
        public void Validate_WithOnlyComments_IsValid()
        {
            Assert.True(IsValid(Valid() with
            {
                Evaluations = System.Array.Empty<SaveSessionEvaluation.EvaluationItem>(),
                Comments = new[] { new SaveSessionEvaluation.CommentItem("tc-1", "Partial", null) }
            }));
        }

        [Fact]
        public void Validate_RepeatedComment_IsInvalid()
        {
            Assert.False(IsValid(Valid() with
            {
                Comments = new[]
                {
                    new SaveSessionEvaluation.CommentItem("tc-1", "Partial", null),
                    new SaveSessionEvaluation.CommentItem("tc-1", "Achieved", null)
                }
            }));
        }

        [Theory]
        [InlineData("", "Partial", null)]
        [InlineData("tc-1", "Excellent", null)]
        public void Validate_InvalidComment_IsInvalid(string trackingCommentId, string assessment, string? note)
        {
            Assert.False(IsValid(Valid() with { Comments = new[] { new SaveSessionEvaluation.CommentItem(trackingCommentId, assessment, note) } }));
        }

        [Fact]
        public void Validate_CommentNoteOver500Chars_IsInvalid()
        {
            Assert.False(IsValid(Valid() with
            {
                Comments = new[] { new SaveSessionEvaluation.CommentItem("tc-1", "Partial", new string('a', 501)) }
            }));
        }

        [Theory]
        [InlineData("", null)]
        [InlineData("   ", null)]
        public void CreateTrackingComment_WithoutTitle_IsInvalid(string title, string? description)
        {
            var command = new CreateTrackingComment.Command { TeamId = "team-1", Title = title, Description = description };

            Assert.False(new CreateTrackingComment.Validator().Validate(command).IsValid);
        }

        [Fact]
        public void CreateTrackingComment_TooLongTitleOrDescription_IsInvalid()
        {
            var validator = new CreateTrackingComment.Validator();

            Assert.False(validator.Validate(new CreateTrackingComment.Command { TeamId = "team-1", Title = new string('a', 101) }).IsValid);
            Assert.False(validator.Validate(new CreateTrackingComment.Command
            {
                TeamId = "team-1", Title = "Paciencia", Description = new string('a', 501)
            }).IsValid);
            Assert.True(validator.Validate(new CreateTrackingComment.Command { TeamId = "team-1", Title = "Paciencia" }).IsValid);
        }

        [Fact]
        public void Validate_RepeatedSubprincipio_IsInvalid()
        {
            Assert.False(IsValid(Valid() with
            {
                Evaluations = new[]
                {
                    new SaveSessionEvaluation.EvaluationItem("sub-31", "NotAchieved", null),
                    new SaveSessionEvaluation.EvaluationItem("sub-31", "Achieved", null)
                }
            }));
        }

        [Theory]
        [InlineData("", "Partial", null)]
        [InlineData("sub-31", "Excellent", null)]
        public void Validate_InvalidItem_IsInvalid(string subprincipioId, string assessment, string? comment)
        {
            Assert.False(IsValid(Valid() with { Evaluations = new[] { new SaveSessionEvaluation.EvaluationItem(subprincipioId, assessment, comment) } }));
        }

        [Fact]
        public void Validate_CommentOver500Chars_IsInvalid()
        {
            Assert.False(IsValid(Valid() with
            {
                Evaluations = new[] { new SaveSessionEvaluation.EvaluationItem("sub-31", "Partial", new string('a', 501)) }
            }));
        }

        [Fact]
        public void Requests_RequireGameModelPermissionAndTeamMembership()
        {
            var save = Valid();
            var get = new GetSessionEvaluation.Query { TeamId = "team-1", TeamPlayerId = "tp-1", SessionId = "ses-1" };
            var delete = new DeleteSessionEvaluation.Command { TeamId = "team-1", TeamPlayerId = "tp-1", SessionId = "ses-1" };
            var list = new GetPlayerSessionEvaluations.Query { TeamId = "team-1", TeamPlayerId = "tp-1" };
            var comments = new GetTrackingComments.Query { TeamId = "team-1" };
            var createComment = new CreateTrackingComment.Command { TeamId = "team-1", Title = "Paciencia" };

            foreach (var (request, permission) in new (object, string)[]
            {
                (save, "ReadWrite"), (get, "Read"), (delete, "ReadWrite"), (list, "Read"), (comments, "Read"), (createComment, "ReadWrite")
            })
            {
                Assert.IsAssignableFrom<IRequireTeamMembership>(request);
                var feature = Assert.IsAssignableFrom<IRequireFeaturePermission>(request);
                Assert.Equal(CoachFeatureRoutes.GameModel, feature.FeatureRoute);
                Assert.Equal(permission, feature.RequiredPermission);
            }
        }
    }
}
