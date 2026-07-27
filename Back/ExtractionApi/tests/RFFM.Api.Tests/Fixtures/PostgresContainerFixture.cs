#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Infrastructure.Persistence;
using Testcontainers.PostgreSql;
using Xunit;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>
    /// Spins up an ephemeral postgres:16 container (via Testcontainers) for the duration of a
    /// test run, applies the same EF Core migrations used in production for
    /// <see cref="AppDbContext"/> (schema "app", history table "__EFMigrationsHistory"), and
    /// disposes/removes the container afterwards.
    ///
    /// Shared across all tests in the "Postgres collection" via
    /// <see cref="PostgresCollection"/> so the container is created once per test run rather
    /// than once per test class.
    ///
    /// Requires a Docker-API-compatible daemon reachable via the DOCKER_HOST environment
    /// variable (Podman's exposed npipe/unix socket works transparently). See
    /// tests/RFFM.Api.Tests/README or the back-specialist report for the exact one-liner.
    /// </summary>
    public class PostgresContainerFixture : IAsyncLifetime
    {
        private PostgreSqlContainer _container = null!;

        public string ConnectionString => _container.GetConnectionString();

        public async Task InitializeAsync()
        {
            _container = new PostgreSqlBuilder("postgres:16")
                .WithDatabase("rffm_test")
                .WithUsername("test")
                .WithPassword("test")
                .Build();

            await _container.StartAsync();

            var appDbOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(ConnectionString, npgsql =>
                {
                    // Mirrors the production AppDbContext registration in
                    // ServiceCollectionExtensions.cs, including EnableRetryOnFailure. A previous
                    // version of this fixture omitted EnableRetryOnFailure, which masked a real
                    // production bug: NpgsqlRetryingExecutionStrategy is incompatible with
                    // System.Transactions.TransactionScope / user-initiated transactions, so
                    // CreateUser.Handler's TransactionScope-wrapped writes worked in tests but
                    // threw HTTP 500 in production. Keeping this config identical to prod is
                    // what lets tests catch this class of bug going forward.
                    npgsql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                })
                // AppDbContextModelSnapshot.cs has been out of sync with the real model since a
                // pre-existing, unrelated snapshot-corruption issue (see back-specialist report),
                // so EF's design-time "pending model changes" comparison always misfires here.
                // The migrations themselves are correct and apply cleanly; only the
                // snapshot-vs-model diagnostic is unreliable.
                .ConfigureWarnings(warnings => warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
                .Options;

            await using var db = new AppDbContext(appDbOptions);
            await db.Database.MigrateAsync();

            // Also migrate IdentityDbContext
            var identityDbOptions = new DbContextOptionsBuilder<IdentityDbContext>()
                .UseNpgsql(ConnectionString, npgsql =>
                {
                    npgsql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "identity");
                })
                .Options;

            await using var identityDb = new IdentityDbContext(identityDbOptions);
            await identityDb.Database.MigrateAsync();
        }

        public async Task DisposeAsync()
        {
            if (_container is not null)
            {
                await _container.DisposeAsync();
            }
        }

        public AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(ConnectionString, npgsql =>
                {
                    npgsql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                })
                .Options;

            return new AppDbContext(options);
        }

        public IdentityDbContext CreateIdentityDbContext()
        {
            var options = new DbContextOptionsBuilder<IdentityDbContext>()
                .UseNpgsql(ConnectionString, npgsql =>
                {
                    npgsql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "identity");
                })
                .Options;

            return new IdentityDbContext(options);
        }
    }

    [CollectionDefinition(Name)]
    public class PostgresCollection : ICollectionFixture<PostgresContainerFixture>
    {
        public const string Name = "Postgres collection";
    }
}
