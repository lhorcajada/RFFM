#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression test for a production bug: GetTeamPlayersForSelection.Handler.Handle threw
    /// System.InvalidOperationException ("could not be translated") because the query chained
    /// .OrderBy/.ThenBy AFTER the .Select() that projects into the PlayerForSelection record,
    /// which also contains a ternary expression over the owned-type Dorsal value object
    /// (tp.Dorsal != null ? tp.Dorsal.Number : null). EF Core cannot translate an ORDER BY that
    /// has to reconstruct that ternary from the already-projected record.
    ///
    /// This must run against a real Postgres instance (Testcontainers), not the classic EF Core
    /// InMemory provider, because InMemory doesn't attempt SQL translation and would not
    /// reproduce the failure.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamPlayersForSelectionTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamPlayersForSelectionTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_TeamWithPlayersIncludingDorsal_ReturnsPlayersOrderedByNameThenLastName()
        {
            // Arrange
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Selection Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Selection Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var playerZeta = Player.Create(new PlayerModelBase
            {
                Name = "Zeta",
                LastName = "Alonso",
                Alias = "zeta",
                ClubId = club.Id
            });
            var playerAlpha = Player.Create(new PlayerModelBase
            {
                Name = "Alpha",
                LastName = "Beltran",
                Alias = "alpha",
                ClubId = club.Id
            });
            setupDb.Players.AddRange(playerZeta, playerAlpha);
            await setupDb.SaveChangesAsync();

            var teamPlayerZeta = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = playerZeta.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = new DorsalModel { Number = 9 },
                FamilyMembers = new List<FamilyModel>()
            });
            var teamPlayerAlpha = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = playerAlpha.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.AddRange(teamPlayerZeta, teamPlayerAlpha);
            await setupDb.SaveChangesAsync();

            // Act
            await using var readDb = _fixture.CreateDbContext();
            var handler = new GetTeamPlayersForSelection.Handler(readDb);
            var response = await handler.Handle(
                new GetTeamPlayersForSelection.GetTeamPlayersQuery(team.Id),
                CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.Equal(2, response!.Players.Count);
            Assert.Equal("Alpha", response.Players[0].Name);
            Assert.Equal("Zeta", response.Players[1].Name);
            Assert.Equal(9, response.Players[1].Dorsal);
            Assert.Null(response.Players[0].Dorsal);
        }
    }
}
