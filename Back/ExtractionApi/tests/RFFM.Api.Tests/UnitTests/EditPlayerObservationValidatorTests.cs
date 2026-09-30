#nullable enable
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.PlayerTracking;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class EditPlayerObservationValidatorTests
    {
        private static UpdatePlayerObservation.Command ValidUpdate() => new()
        {
            TeamId = "team-1",
            TeamPlayerId = "tp-1",
            ObservationId = "obs-1",
            Assessment = "Partial",
            Comment = "Mejora tras la charla"
        };

        private static bool IsValid(UpdatePlayerObservation.Command command) =>
            new UpdatePlayerObservation.Validator().Validate(command).IsValid;

        [Fact]
        public void Update_ValidCommand_IsValid()
        {
            Assert.True(IsValid(ValidUpdate()));
        }

        [Theory]
        [InlineData("")]
        [InlineData("Excellent")]
        public void Update_UnknownAssessment_IsInvalid(string assessment)
        {
            Assert.False(IsValid(ValidUpdate() with { Assessment = assessment }));
        }

        [Fact]
        public void Update_CommentOver500Chars_IsInvalid()
        {
            Assert.False(IsValid(ValidUpdate() with { Comment = new string('a', 501) }));
        }

        [Fact]
        public void Update_EmptyObservationId_IsInvalid()
        {
            Assert.False(IsValid(ValidUpdate() with { ObservationId = "" }));
        }

        [Fact]
        public void Delete_EmptyObservationId_IsInvalid()
        {
            var command = new DeletePlayerObservation.Command { TeamId = "team-1", TeamPlayerId = "tp-1", ObservationId = "" };

            Assert.False(new DeletePlayerObservation.Validator().Validate(command).IsValid);
        }

        [Fact]
        public void Commands_RequireGameModelReadWriteAndTeamMembership()
        {
            object[] commands =
            {
                ValidUpdate(),
                new DeletePlayerObservation.Command { TeamId = "team-1", TeamPlayerId = "tp-1", ObservationId = "obs-1" }
            };

            foreach (var command in commands)
            {
                Assert.IsAssignableFrom<IRequireTeamMembership>(command);
                var permission = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
                Assert.Equal(CoachFeatureRoutes.GameModel, permission.FeatureRoute);
                Assert.Equal("ReadWrite", permission.RequiredPermission);
            }
        }
    }
}
