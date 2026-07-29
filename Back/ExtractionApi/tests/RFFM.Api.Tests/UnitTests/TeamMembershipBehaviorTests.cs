#nullable enable
using Mediator;
using Moq;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class TeamMembershipBehaviorTests
    {
        private readonly PostgresContainerFixture _fixture;

        public TeamMembershipBehaviorTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private record FakeTeamRequest(string TeamId) : IRequest<string>, IRequireTeamMembership;

        private Mock<ICurrentUserService> MockCurrentUser(string userId, bool isAuthenticated, string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(isAuthenticated);
            mock.Setup(u => u.Roles).Returns(roles);
            return mock;
        }

        [Fact]
        public async Task Handle_PlayerWithoutTeamMembership_ThrowsForbiddenAccessException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var teamId = Guid.NewGuid().ToString();

            // Player does NOT have membership to this team (empty DB)
            var mockCurrentUser = MockCurrentUser(userId, isAuthenticated: true, roles: new[] { "Player" });

            var behavior = new TeamMembershipBehavior<FakeTeamRequest, string>(mockCurrentUser.Object, db);
            var request = new FakeTeamRequest(teamId);

            var nextCalled = false;
            ValueTask<string> Next(FakeTeamRequest req, CancellationToken ct)
            {
                nextCalled = true;
                return ValueTask.FromResult("success");
            }

            // Act & Assert
            var ex = await Assert.ThrowsAsync<ForbiddenAccessException>(
                () => behavior.Handle(request, Next, CancellationToken.None).AsTask()
            );

            Assert.False(nextCalled);
            Assert.Contains("equipo", ex.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Handle_CoachRole_BypassesTeamMembershipCheck()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var teamId = Guid.NewGuid().ToString();

            // Coach does NOT have membership, but should bypass the check anyway
            var mockCurrentUser = MockCurrentUser(userId, isAuthenticated: true, roles: new[] { "Coach" });

            var behavior = new TeamMembershipBehavior<FakeTeamRequest, string>(mockCurrentUser.Object, db);
            var request = new FakeTeamRequest(teamId);

            var nextCalled = false;
            ValueTask<string> Next(FakeTeamRequest req, CancellationToken ct)
            {
                nextCalled = true;
                return ValueTask.FromResult("success");
            }

            // Act
            var result = await behavior.Handle(request, Next, CancellationToken.None);

            // Assert
            Assert.True(nextCalled);
            Assert.Equal("success", result);
        }
    }
}
