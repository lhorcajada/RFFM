#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RFFM.Api.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Data-integrity test for the <c>RestructureGameModelPrinciples</c> migration: spins up a
    /// fresh Postgres container, applies every migration up to (but not including)
    /// <c>RestructureGameModelPrinciples</c>, seeds a pre-existing <c>GameScenario</c> the old way
    /// (raw SQL, matching the pre-migration schema), then applies the migration and verifies a
    /// <c>GamePrinciple</c> was generated in the same moment/zone with the scenario's name as its
    /// title, and the scenario is reparented under it as its only scenario.
    /// </summary>
    public class RestructureGameModelPrinciplesMigrationTests : IAsyncLifetime
    {
        private const string PreviousMigration = "20260731125957_AddPushTokens";
        private const string TargetMigration = "20260804103613_RestructureGameModelPrinciples";

        private PostgreSqlContainer _container = null!;

        public async Task InitializeAsync()
        {
            _container = new PostgreSqlBuilder("postgres:16")
                .WithDatabase("rffm_migration_test")
                .WithUsername("test")
                .WithPassword("test")
                .Build();

            await _container.StartAsync();
        }

        public async Task DisposeAsync()
        {
            if (_container is not null)
                await _container.DisposeAsync();
        }

        private AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(_container.GetConnectionString(), npgsql =>
                {
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                })
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
                .Options;

            return new AppDbContext(options);
        }

        [Fact]
        public async Task Migration_WrapsPreExistingScenarioInAGeneratedPrinciple()
        {
            var gameModelId = Guid.NewGuid().ToString();
            var scenarioId = Guid.NewGuid().ToString();
            const string teamId = "team-1";
            const string scenarioName = "Escenario 1: El rival juega por bandas";
            const int gameMomentId = 1; // Defensa Organizada
            const int gameZoneId = 1;   // Zona de Iniciación

            // 1. Migrate up to (but not including) RestructureGameModelPrinciples.
            await using (var db = CreateDbContext())
            {
                var migrator = db.GetService<IMigrator>();
                await migrator.MigrateAsync(PreviousMigration);
            }

            // 2. Seed a pre-existing GameModel + GameScenario using the pre-migration schema
            //    (GameScenarios still has GameModelId/GameMomentId/GameZoneId at this point).
            await using (var db = CreateDbContext())
            {
                await db.Database.ExecuteSqlInterpolatedAsync($@"
                    INSERT INTO app.""GameModels"" (""Id"", ""TeamId"", ""Name"", ""Season"")
                    VALUES ({gameModelId}, {teamId}, 'Modelo migracion', '2025-2026');
                ");

                await db.Database.ExecuteSqlInterpolatedAsync($@"
                    INSERT INTO app.""GameScenarios"" (""Id"", ""GameModelId"", ""GameMomentId"", ""GameZoneId"", ""Order"", ""Name"", ""Context"")
                    VALUES ({scenarioId}, {gameModelId}, {gameMomentId}, {gameZoneId}, 1, {scenarioName}, 'Contexto');
                ");
            }

            // 3. Apply the RestructureGameModelPrinciples migration.
            await using (var db = CreateDbContext())
            {
                var migrator = db.GetService<IMigrator>();
                await migrator.MigrateAsync(TargetMigration);
            }

            // 4. Verify: exactly one GamePrinciple was generated, same moment/zone, titled with the
            //    scenario's old name, empty description, and the scenario is reparented under it.
            await using (var db = CreateDbContext())
            {
                var principles = await db.GamePrinciples
                    .Where(p => p.GameModelId == gameModelId)
                    .ToListAsync();

                var principle = Assert.Single(principles);
                Assert.Equal(scenarioName, principle.Title);
                Assert.Equal(string.Empty, principle.Description);
                Assert.Equal(gameMomentId, principle.GameMomentId);
                Assert.Equal(gameZoneId, principle.GameZoneId);

                var scenario = await db.GameScenarios.SingleAsync(s => s.Id == scenarioId);
                Assert.Equal(principle.Id, scenario.GamePrincipleId);
                Assert.Equal(1, scenario.Order);
            }
        }
    }
}
