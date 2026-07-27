#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Mobile.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetMyTeamsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetMyTeamsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private Mock<ICurrentUserService> MockCurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(true);
            return mock;
        }

        // Same seeding pattern as InjuryEndpointAuthorizationTests.CreateTeamPlayerAsync:
        // UserTeam.LinkedTeamPlayerId has a real FK to TeamPlayer, which itself has real FKs to
        // Team and Player, so a full graph is required for LinkPlayer() to persist.
        private async Task<(Team Team, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db, string teamName)
        {
            var club = Club.Create($"MyTeams Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = teamName,
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team, teamPlayer.Id);
        }

        [Fact]
        public async Task Handle_UserWithNoTeams_ReturnsEmptyArray()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();

            var mockCurrentUser = MockCurrentUser(userId);
            var handler = new GetMyTeams.Handler(db, mockCurrentUser.Object);
            var query = new GetMyTeams.GetMyTeamsQuery();

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Empty(result);
        }

        [Fact]
        public async Task Handle_UserWithOneTeam_ReturnsTeamWithCorrectFields()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var (team, linkedPlayerId) = await SeedTeamAndPlayerAsync(db, "Test Team");

            var userTeam = new UserTeam(userId, team.Id, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(linkedPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(userId);
            var handler = new GetMyTeams.Handler(db, mockCurrentUser.Object);
            var query = new GetMyTeams.GetMyTeamsQuery();

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result);
            var teamDto = result.First();
            Assert.Equal(team.Id, teamDto.TeamId);
            Assert.Equal("Test Team", teamDto.TeamName);
            Assert.Equal(Membership.Player.Id, teamDto.RoleId);
            Assert.Equal(linkedPlayerId, teamDto.LinkedTeamPlayerId);
        }

        [Fact]
        public async Task Handle_UserWithMultipleTeams_ReturnsAllTeamsInOrder()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();

            var (team1, linkedPlayer1) = await SeedTeamAndPlayerAsync(db, "Team A");
            var (team2, linkedPlayer2) = await SeedTeamAndPlayerAsync(db, "Team B");

            var userTeam1 = new UserTeam(userId, team1.Id, Membership.Player.Id);
            var userTeam2 = new UserTeam(userId, team2.Id, Membership.FamilyPlayer.Id);
            db.Set<UserTeam>().AddRange(userTeam1, userTeam2);
            await db.SaveChangesAsync();

            userTeam1.LinkPlayer(linkedPlayer1);
            userTeam2.LinkPlayer(linkedPlayer2);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(userId);
            var handler = new GetMyTeams.Handler(db, mockCurrentUser.Object);
            var query = new GetMyTeams.GetMyTeamsQuery();

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(2, result.Count());

            var teams = result.ToList();
            Assert.Contains(teams, t => t.TeamId == team1.Id && t.RoleId == Membership.Player.Id);
            Assert.Contains(teams, t => t.TeamId == team2.Id && t.RoleId == Membership.FamilyPlayer.Id);
        }
    }
}
