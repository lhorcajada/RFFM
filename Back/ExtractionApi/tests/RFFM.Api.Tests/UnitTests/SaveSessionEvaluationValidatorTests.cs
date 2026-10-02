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
        public void Validate_WithoutEvaluations_IsInvalid()
        {
            Assert.False(IsValid(Valid() with { Evaluations = System.Array.Empty<SaveSessionEvaluation.EvaluationItem>() }));
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

            foreach (var (request, permission) in new (object, string)[] { (save, "ReadWrite"), (get, "Read"), (delete, "ReadWrite") })
            {
                Assert.IsAssignableFrom<IRequireTeamMembership>(request);
                var feature = Assert.IsAssignableFrom<IRequireFeaturePermission>(request);
                Assert.Equal(CoachFeatureRoutes.GameModel, feature.FeatureRoute);
                Assert.Equal(permission, feature.RequiredPermission);
            }
        }
    }
}
