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
using RFFM.Api.Infrastructure.GameModelImport;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration test for <see cref="AdnLegibleImporter.UpsertAsync"/>: covers the "re-running
    /// the import is idempotent" scenario from the game-model spec — upserting the same parsed
    /// tree twice must not duplicate Principios/Subprincipios/Zonas/SubSubPrincipios/Habilidades/Notas.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class AdnLegibleImporterUpsertTests
    {
        private readonly PostgresContainerFixture _fixture;

        public AdnLegibleImporterUpsertTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private const string FixtureMarkdown = """
            ## 1. Defensa organizada

            1. **No permitir progresar al rival.** Texto del principio.

               - **Subprincipio 1.1 — Evitar que el rival supere nuestra primera línea de presión.** Texto del subprincipio.

                 - **Zona de Finalización.** Texto de la zona.

                   - **Sub-subprincipio 1.1.1 — Delantero:** Texto del sub-subprincipio.
                     - Habilidad imprescindible — **Activación**: Descripcion. (Entrenable: Entrenable.)

                   *Riesgo aceptado: El lateral opuesto rival queda libre.*
            """;

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Importer Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Importer Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task UpsertAsync_RunTwice_DoesNotDuplicateEntities()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(seedDb);

            var importer = new AdnLegibleImporter();
            var imported = importer.Parse(FixtureMarkdown);

            await using var db1 = _fixture.CreateDbContext();
            var gameModelId1 = await importer.UpsertAsync(db1, imported, teamId, "Modelo ADN", "2025-2026", CancellationToken.None);

            // Re-parse (fresh in-memory tree, as a real re-run against an unchanged document would produce)
            // and upsert a second time.
            var importedAgain = importer.Parse(FixtureMarkdown);
            await using var db2 = _fixture.CreateDbContext();
            var gameModelId2 = await importer.UpsertAsync(db2, importedAgain, teamId, "Modelo ADN", "2025-2026", CancellationToken.None);

            Assert.Equal(gameModelId1, gameModelId2);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.Equal(1, await verifyDb.GamePrinciples.CountAsync(p => p.GameModelId == gameModelId1));
            Assert.Equal(1, await verifyDb.Subprincipios.CountAsync(sp => sp.GamePrinciple.GameModelId == gameModelId1));
            Assert.Equal(1, await verifyDb.Zonas.CountAsync(z => z.Subprincipio.GamePrinciple.GameModelId == gameModelId1));
            Assert.Equal(1, await verifyDb.SubSubPrincipios.CountAsync(ssp => ssp.Zona!.Subprincipio.GamePrinciple.GameModelId == gameModelId1));
            Assert.Equal(1, await verifyDb.Habilidades.CountAsync(h => h.SubSubPrincipio.Zona!.Subprincipio.GamePrinciple.GameModelId == gameModelId1));
            Assert.Equal(1, await verifyDb.Notas.CountAsync(n => n.GameModelId == gameModelId1));
        }

        [Fact]
        public async Task UpsertAsync_PersistsFullTree()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(seedDb);

            var importer = new AdnLegibleImporter();
            var imported = importer.Parse(FixtureMarkdown);

            await using var db = _fixture.CreateDbContext();
            var gameModelId = await importer.UpsertAsync(db, imported, teamId, "Modelo ADN", "2025-2026", CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principle = await verifyDb.GamePrinciples.SingleAsync(p => p.GameModelId == gameModelId);
            Assert.Equal("defensa-organizada-1", principle.Key);

            var nota = await verifyDb.Notas.SingleAsync(n => n.GameModelId == gameModelId);
            Assert.Equal("riesgo-aceptado", nota.Tipo);
            Assert.NotNull(nota.ZonaId);
        }
    }
}
