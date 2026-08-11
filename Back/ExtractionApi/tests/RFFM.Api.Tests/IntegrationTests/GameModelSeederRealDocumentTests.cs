#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Persistence.Seed;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// End-to-end test of <see cref="GameModelSeeder"/> (design.md §2.1 / tasks.md §7's seed
    /// step) against the real `docs/game-model/ADN-Modelo-de-Juego-Legible.md` — proves the
    /// importer + upsert pipeline works against the actual document, not just fixtures, and that
    /// re-seeding is idempotent (no duplicated rows on a second run).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GameModelSeederRealDocumentTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GameModelSeederRealDocumentTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Seeder Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Seeder Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task SeedAsync_RealDocument_ImportsFullTreeAndIsIdempotentOnRerun()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(seedDb);

            await using var db1 = _fixture.CreateDbContext();
            var gameModelId1 = await GameModelSeeder.SeedAsync(db1, teamId, "Modelo ADN real", "2025-2026", ct: CancellationToken.None);

            await using var db2 = _fixture.CreateDbContext();
            var gameModelId2 = await GameModelSeeder.SeedAsync(db2, teamId, "Modelo ADN real", "2025-2026", ct: CancellationToken.None);

            Assert.Equal(gameModelId1, gameModelId2);

            await using var verifyDb = _fixture.CreateDbContext();
            var principleCount = await verifyDb.GamePrinciples.CountAsync(p => p.GameModelId == gameModelId1);
            Assert.Equal(7, principleCount);

            var subprincipioCount = await verifyDb.Subprincipios.CountAsync(sp => sp.GamePrinciple.GameModelId == gameModelId1);
            Assert.True(subprincipioCount > 0);

            var openIssueCount = await verifyDb.OpenIssues.CountAsync(o => o.GameModelId == gameModelId1);
            Assert.Equal(1, openIssueCount);
        }
    }
}
