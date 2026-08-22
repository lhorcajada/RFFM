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
    /// 2ª División) calendar transcribed from docs/game-model/Plan-de-Temporada.docx: 4
    /// macrociclos (Pretemporada, Iniciación, Perfeccionamiento + "Cierre de temporada"), 14
    /// mesociclos (generaciones 1–12, with generación 6 split across two Mesociclo rows —
    /// "parte 1" in Macrociclo 2 and "continuación" in Macrociclo 3 — plus Cierre), 31
    /// microciclos (Microciclos 1–30 plus the Cierre block) — and that re-running it against the
    /// same team/season updates in place rather than duplicating.
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

            Assert.Equal(4, macrociclos.Count);
            Assert.Equal(14, mesociclos.Count);
            Assert.Equal(31, microciclos.Count);
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
            Assert.Equal(4, macrociclos.Count);
        }

        [Fact]
        public async Task ImportAsync_Macrociclo1_MatchesSourceDocument()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var planId = await new SeasonPlanImporter(db).ImportAsync(teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var macrociclo1 = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .SingleAsync(m => m.SeasonPlanId == planId && m.Order == 1);

            Assert.Equal("Macrociclo 1 — Pretemporada", macrociclo1.Name);
            Assert.Equal(2, macrociclo1.Mesociclos.Count);

            var mesociclo1 = macrociclo1.Mesociclos.Single(m => m.Order == 1);
            Assert.Equal("Mesociclo 1 — generación 1", mesociclo1.Name);
            // Placeholder Mesociclo-level zone = first Microciclo's Sesión A zone (see importer's
            // doc-comment) — Semana 1 trains both sessions in Creación Propia.
            Assert.Equal(2, mesociclo1.GameZoneId);
            Assert.Equal(4, mesociclo1.Microciclos.Count);

            var semana1 = mesociclo1.Microciclos.Single(m => m.Order == 1);
            Assert.Equal("Semana 1 — generación 1", semana1.WeekLabel);
        }

        [Fact]
        public async Task ImportAsync_Macrociclo4_IsCierreDeTemporada()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var planId = await new SeasonPlanImporter(db).ImportAsync(teamId, seasonId, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var cierre = await verifyDb.Macrociclos
                .Include(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .SingleAsync(m => m.SeasonPlanId == planId && m.Order == 4);

            Assert.Equal("Cierre de temporada", cierre.Name);
            var mesociclo = Assert.Single(cierre.Mesociclos);
            Assert.Single(mesociclo.Microciclos);
        }
    }
}
