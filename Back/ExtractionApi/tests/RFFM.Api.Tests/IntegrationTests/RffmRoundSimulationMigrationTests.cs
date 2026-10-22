#nullable enable
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regresión: la primera versión de AddRffmRoundSimulations (sin ModelVersion ni IsBackfilled) ya está
    /// aplicada en la base de datos real con simulaciones guardadas; la migración siguiente debe añadir las
    /// columnas y marcar como rellenadas las que se congelaron al calcularse.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class RffmRoundSimulationMigrationTests(PostgresContainerFixture fixture)
    {
        private const string AppliedMigration = "20261022123532_AddRffmRoundSimulations";

        private async Task<string> CreateEmptyDatabaseAsync()
        {
            var name = $"migration_{Guid.NewGuid():N}";
            await using (var admin = new NpgsqlConnection(fixture.ConnectionString))
            {
                await admin.OpenAsync();
                await using var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", admin);
                await create.ExecuteNonQueryAsync();
            }
            return new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { Database = name }.ConnectionString;
        }

        private static FederationDbContext CreateContext(string connectionString) => new(
            new DbContextOptionsBuilder<FederationDbContext>()
                .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation"))
                .Options);

        [Fact]
        public async Task La_migracion_nueva_anade_las_columnas_y_marca_las_simulaciones_rellenadas()
        {
            var connectionString = await CreateEmptyDatabaseAsync();
            await using (var db = CreateContext(connectionString))
                await db.GetService<IMigrator>().MigrateAsync(AppliedMigration);

            var computedAt = new DateTime(2026, 10, 22, 12, 40, 0, DateTimeKind.Utc);
            await using (var conn = new NpgsqlConnection(connectionString))
            {
                await conn.OpenAsync();
                foreach (var (id, round, frozenAt) in new (string, int, DateTime?)[]
                         {
                             ("backfilled", 1, computedAt),
                             ("frozen-later", 2, computedAt.AddDays(2)),
                             ("open", 3, null)
                         })
                {
                    await using var insert = new NpgsqlCommand("""
                        INSERT INTO federation."RffmRoundSimulations"
                            ("Id", "GroupCode", "SeasonId", "Round", "PlayedMatchesUsed", "UsesSquadStrength", "MatchesJson", "StandingsJson", "ComputedAt", "FrozenAt")
                        VALUES (@id, 'G', 22, @round, 0, false, '[]', '[]', @computedAt, @frozenAt)
                        """, conn);
                    insert.Parameters.AddWithValue("id", id);
                    insert.Parameters.AddWithValue("round", round);
                    insert.Parameters.AddWithValue("computedAt", computedAt);
                    insert.Parameters.AddWithValue("frozenAt", (object?)frozenAt ?? DBNull.Value);
                    await insert.ExecuteNonQueryAsync();
                }
            }

            await using (var db = CreateContext(connectionString))
                await db.Database.MigrateAsync();

            var rows = new Dictionary<string, (bool IsBackfilled, int ModelVersion)>();
            await using (var conn = new NpgsqlConnection(connectionString))
            {
                await conn.OpenAsync();
                await using var select = new NpgsqlCommand("""SELECT "Id", "IsBackfilled", "ModelVersion" FROM federation."RffmRoundSimulations" """, conn);
                await using var reader = await select.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    rows[reader.GetString(0)] = (reader.GetBoolean(1), reader.GetInt32(2));
            }

            Assert.Equal((true, 0), rows["backfilled"]);
            Assert.Equal((false, 0), rows["frozen-later"]);
            Assert.Equal((false, 0), rows["open"]);
        }
    }
}
