#nullable enable
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Queries.GetPlayersByTeam;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetPlayersByTeamDemarcationsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetPlayersByTeamDemarcationsTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static async Task SetDemarcationAsync(AppDbContext db, string teamPlayerId, int activePositionId, List<int> possible)
        {
            var teamPlayer = await db.TeamPlayers.FindAsync(teamPlayerId);
            teamPlayer!.SetDemarcation(new DemarcationModel { ActivePositionId = activePositionId, PossibleDemarcations = possible });
            await db.SaveChangesAsync();
        }

        private static async Task<PlayersByTeamResponse> GetPlayerAsync(AppDbContext db, string teamId, string teamPlayerId)
        {
            var result = await new GetPlayersByTeamRequestHandler(db)
                .Handle(new PlayersByTeamQuery { TeamId = teamId }, CancellationToken.None);
            return result.Single(p => p.Id == teamPlayerId);
        }

        [Fact]
        public async Task Player_with_several_positions_returns_active_and_possible_demarcation_ids()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            await SetDemarcationAsync(db, teamPlayerId, 6, new List<int> { 6, 8 });

            var player = await GetPlayerAsync(db, teamId, teamPlayerId);

            Assert.Equal(6, player.ActivePositionId);
            Assert.Equal(new[] { 6, 8 }, player.PossibleDemarcationIds);
            Assert.Equal("Medio Centro", player.Position);
        }

        [Fact]
        public async Task Player_without_demarcation_returns_null_active_and_empty_possible_ids()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);

            var player = await GetPlayerAsync(db, teamId, teamPlayerId);

            Assert.Null(player.ActivePositionId);
            Assert.Empty(player.PossibleDemarcationIds);
        }
    }
}
