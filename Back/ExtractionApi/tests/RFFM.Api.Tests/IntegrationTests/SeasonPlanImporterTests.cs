#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Verifies <see cref="SeasonPlanImporter"/> upserts the full "Plan de Temporada" (Cadete,
    /// 2ª División) calendar transcribed from docs/game-model/Plan-de-Temporada.docx: 3
    /// macrociclos (2 real + "Cierre de temporada"), 9 mesociclos, 37 microciclos — and that
    /// re-running it against the same team/season updates in place rather than duplicating.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SeasonPlanImporterTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SeasonPlanImporterTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"SeasonPlanImporter Test Club {Guid.NewGuid():N}", 1);
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
                Name = "SeasonPlanImporter Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, season.Id);
        }

        [Fact]
        public async Task ImportAsync_PersistsFullCalendarWithExpectedCounts()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var importer = new SeasonPlanImporter(db);

            var planId = await importer.ImportAsync(teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclos = await verifyDb.Macrociclos.Where(m => m.SeasonPlanId == planId).ToListAsync();
            var mesociclos = await verifyDb.Mesociclos.Where(m => macrociclos.Select(x => x.Id).Contains(m.MacrocicloId)).ToListAsync();
            var microciclos = await verifyDb.Microciclos.Where(m => mesociclos.Select(x => x.Id).Contains(m.MesocicloId)).ToListAsync();

            Assert.Equal(3, macrociclos.Count);
            Assert.Equal(9, mesociclos.Count);
            Assert.Equal(37, microciclos.Count);
        }

        [Fact]
        public async Task ImportAsync_RunTwice_UpsertsInPlaceWithoutDuplicating()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var firstDb = _fixture.CreateDbContext();
            var firstPlanId = await new SeasonPlanImporter(firstDb).ImportAsync(teamId, seasonId, CancellationToken.None);

            await using var secondDb = _fixture.CreateDbContext();
            var secondPlanId = await new SeasonPlanImporter(secondDb).ImportAsync(teamId, seasonId, CancellationToken.None);

            Assert.Equal(firstPlanId, secondPlanId);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.Equal(1, await verifyDb.SeasonPlans.CountAsync(sp => sp.TeamId == teamId && sp.SeasonId == seasonId));
            var macrociclos = await verifyDb.Macrociclos.Where(m => m.SeasonPlanId == firstPlanId).ToListAsync();
            Assert.Equal(3, macrociclos.Count);
        }

        [Fact]
        public async Task ImportAsync_Macrociclo1Mesociclo1_1_MatchesSourceDocument()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var planId = await new SeasonPlanImporter(db).ImportAsync(teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclo1 = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .SingleAsync(m => m.SeasonPlanId == planId && m.Order == 1);

            Assert.Equal("Macrociclo 1", macrociclo1.Name);
            Assert.Equal(4, macrociclo1.Mesociclos.Count);

            var mesociclo11 = macrociclo1.Mesociclos.Single(m => m.Order == 1);
            Assert.Equal("Mesociclo 1.1 — Creación Propia", mesociclo11.Name);
            Assert.Equal(2, mesociclo11.GameZoneId);
            Assert.Equal(3, mesociclo11.Microciclos.Count);

            var semana1 = mesociclo11.Microciclos.Single(m => m.Order == 1);
            Assert.Contains("evitar que el rival progrese con orden", semana1.ObjetivoSesionA);
            Assert.Contains("empezar a desorganizar al rival por dentro", semana1.ObjetivoSesionB);
        }
    }
}
