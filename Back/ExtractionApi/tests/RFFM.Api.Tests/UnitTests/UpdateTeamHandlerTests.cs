#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UpdateTeamHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateTeamHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string ClubId)> SeedTeamAsync(
            AppDbContext db, int? leagueId = null, int? leagueGroup = null)
        {
            var club = Club.Create($"UpdateTeam Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "UpdateTeam Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                LeagueId = leagueId,
                LeagueGroup = leagueGroup
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id);
        }

        private static UpdateTeamCommand UpdateCommand(string teamId, string clubId, int? leagueId, int? leagueGroup) => new()
        {
            TeamModel = new TeamModel
            {
                Id = teamId,
                Name = "UpdateTeam Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = clubId,
                UrlPhoto = null,
                LeagueId = leagueId,
                LeagueGroup = leagueGroup
            }
        };

        [Fact]
        public async Task Handle_UpdatesLeagueIdAndLeagueGroup_PersistsNewValues()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(seedDb, leagueId: null, leagueGroup: null);

            await using var updateDb = _fixture.CreateDbContext();
            var handler = new UpdateTeamHandler(updateDb);
            await handler.Handle(UpdateCommand(teamId, clubId, leagueId: 1, leagueGroup: 2), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);

            Assert.Equal(1, team.LeagueId);
            Assert.Equal(2, team.LeagueGroup);
        }

        [Fact]
        public async Task Handle_ClearsLeagueIdAndLeagueGroup_WhenSetToNull()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, clubId) = await SeedTeamAsync(seedDb, leagueId: 1, leagueGroup: 2);

            await using var updateDb = _fixture.CreateDbContext();
            var handler = new UpdateTeamHandler(updateDb);
            await handler.Handle(UpdateCommand(teamId, clubId, leagueId: null, leagueGroup: null), CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);

            Assert.Null(team.LeagueId);
            Assert.Null(team.LeagueGroup);
        }
    }
}
