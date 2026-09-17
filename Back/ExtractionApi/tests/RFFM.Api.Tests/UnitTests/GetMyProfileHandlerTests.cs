#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.Users.Queries;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetMyProfileHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetMyProfileHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_WithUserTeamLinkedTeamPlayerId_ReturnsTeamPlayerId()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayer = await PlayerDocumentTestData.CreateTeamPlayerWithTeamAsync(db);

            var userTeam = new UserTeam("user-123", teamPlayer.TeamId, Membership.Player.Id);
            userTeam.LinkPlayer(teamPlayer.TeamPlayerId);
            db.Add(userTeam);
            await db.SaveChangesAsync();

            var profile = new UserProfile("user-123", "Player", null, teamPlayer.TeamId);
            db.Add(profile);
            await db.SaveChangesAsync();

            var handler = new GetMyProfileHandler(db);
            var result = await handler.Handle(new GetMyProfileQuery("user-123"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(teamPlayer.TeamPlayerId, result!.TeamPlayerId);
        }

        [Fact]
        public async Task Handle_WithoutMatchingUserTeam_ReturnsNullTeamPlayerId()
        {
            await using var db = _fixture.CreateDbContext();

            var profile = new UserProfile("user-456", "Coach", null, "team-2");
            db.Add(profile);
            await db.SaveChangesAsync();

            var handler = new GetMyProfileHandler(db);
            var result = await handler.Handle(new GetMyProfileQuery("user-456"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Null(result!.TeamPlayerId);
        }

        [Fact]
        public async Task Handle_WithoutTeamId_ReturnsNullTeamPlayerId()
        {
            await using var db = _fixture.CreateDbContext();

            var profile = new UserProfile("user-789", "Administrator", null, null);
            db.Add(profile);
            await db.SaveChangesAsync();

            var handler = new GetMyProfileHandler(db);
            var result = await handler.Handle(new GetMyProfileQuery("user-789"), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Null(result!.TeamPlayerId);
        }
    }
}
