#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using GetTeamFundFeature = RFFM.Api.Features.Coaches.Teams.Queries.GetTeamFund;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Covers GET /api/catalog/team/{teamId}/fund
    /// (<see cref="GetTeamFundFeature.TeamFundQuery"/>), the read endpoint for the per-team fund
    /// balance (add-team-fund-and-sanction-player-photo, design.md Decisión 3). Mirrors
    /// GetSeasonPlanHandlerTests's direct-handler testing style for standard CQRS query features.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamFundHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamFundHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> CreateTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"GetTeamFund Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "GetTeamFund Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_TeamWithNoMovements_ReturnsZeroBalanceAndEmptyMovements()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await CreateTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamFundFeature.Handler(db);

            var result = await handler.Handle(new GetTeamFundFeature.TeamFundQuery(teamId), CancellationToken.None);

            Assert.Equal(teamId, result.TeamId);
            Assert.Equal(0m, result.Balance);
            Assert.Empty(result.Movements);
        }

        [Fact]
        public async Task Handle_TeamWithMovements_ReturnsSummedBalanceAndMovementsOrderedByOccurredAtDesc()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await CreateTeamAsync(seedDb);

            var older = TeamFundMovement.Create(
                teamId, 40m, TeamFundMovementSource.SanctionPayment, sourceSanctionId: $"sanction-{Guid.NewGuid():N}",
                occurredAt: DateTime.UtcNow.AddDays(-1));
            var newer = TeamFundMovement.Create(
                teamId, 25m, TeamFundMovementSource.SanctionPayment, sourceSanctionId: $"sanction-{Guid.NewGuid():N}",
                occurredAt: DateTime.UtcNow);
            seedDb.TeamFundMovements.AddRange(older, newer);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamFundFeature.Handler(db);

            var result = await handler.Handle(new GetTeamFundFeature.TeamFundQuery(teamId), CancellationToken.None);

            Assert.Equal(65m, result.Balance);
            Assert.Equal(2, result.Movements.Length);
            Assert.Equal(newer.Id, result.Movements[0].Id);
            Assert.Equal(older.Id, result.Movements[1].Id);
            Assert.Equal("SanctionPayment", result.Movements[0].Source);
        }

        [Fact]
        public async Task Handle_TeamWithMovementsFromAnotherTeam_ExcludesThem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await CreateTeamAsync(seedDb);
            var otherTeamId = await CreateTeamAsync(seedDb);

            seedDb.TeamFundMovements.Add(TeamFundMovement.Create(
                teamId, 40m, TeamFundMovementSource.SanctionPayment, sourceSanctionId: $"sanction-{Guid.NewGuid():N}"));
            seedDb.TeamFundMovements.Add(TeamFundMovement.Create(
                otherTeamId, 999m, TeamFundMovementSource.SanctionPayment, sourceSanctionId: $"sanction-{Guid.NewGuid():N}"));
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamFundFeature.Handler(db);

            var result = await handler.Handle(new GetTeamFundFeature.TeamFundQuery(teamId), CancellationToken.None);

            Assert.Equal(40m, result.Balance);
            Assert.Single(result.Movements);
        }
    }
}
