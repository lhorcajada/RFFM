#nullable enable
using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    [Collection(PostgresCollection.Name)]
    public class SquadHistoryWorkerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SquadHistoryWorkerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private sealed class RecordingGenerator : ISquadHistoryGenerator
        {
            public ConcurrentQueue<string> Processed { get; } = new();

            public Task GenerateAsync(string reportId, CancellationToken cancellationToken)
            {
                Processed.Enqueue(reportId);
                if (reportId == "boom") throw new InvalidOperationException("fallo");
                return Task.CompletedTask;
            }
        }

        private (SquadHistoryWorker Worker, ISquadHistoryQueue Queue, RecordingGenerator Generator) Build()
        {
            var generator = new RecordingGenerator();
            var queue = new SquadHistoryQueue();
            var services = new ServiceCollection();
            services.AddDbContext<FederationDbContext>(o => o.UseNpgsql(_fixture.ConnectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "federation")));
            services.AddScoped<ISquadHistoryGenerator>(_ => generator);
            var provider = services.BuildServiceProvider();

            var worker = new SquadHistoryWorker(queue, provider.GetRequiredService<IServiceScopeFactory>(),
                NullLogger<SquadHistoryWorker>.Instance);
            return (worker, queue, generator);
        }

        private static async Task WaitUntilAsync(Func<bool> condition)
        {
            var timeout = DateTime.UtcNow.AddSeconds(10);
            while (!condition() && DateTime.UtcNow < timeout)
                await Task.Delay(50);
        }

        [Fact]
        public async Task Al_arrancar_reencola_los_informes_pendientes_o_en_curso()
        {
            await using (var db = _fixture.CreateFederationDbContext())
            {
                var running = SquadHistoryReport.Create($"W{Guid.NewGuid():N}"[..20], "Equipo", 22, 21, "user");
                running.Start(5);
                var completed = SquadHistoryReport.Create($"W{Guid.NewGuid():N}"[..20], "Equipo", 22, 21, "user");
                completed.Complete(Array.Empty<SquadHistoryEntry>());
                db.SquadHistoryReports.AddRange(running, completed);
                await db.SaveChangesAsync();

                var (worker, _, generator) = Build();
                await worker.StartAsync(CancellationToken.None);
                await WaitUntilAsync(() => generator.Processed.Contains(running.Id));
                await worker.StopAsync(CancellationToken.None);

                Assert.Contains(running.Id, generator.Processed);
                Assert.DoesNotContain(completed.Id, generator.Processed);
            }
        }

        [Fact]
        public async Task Procesa_lo_encolado_y_sigue_vivo_tras_un_error()
        {
            var (worker, queue, generator) = Build();
            await worker.StartAsync(CancellationToken.None);

            await queue.EnqueueAsync("boom");
            await queue.EnqueueAsync("ok");
            await WaitUntilAsync(() => generator.Processed.Contains("ok"));
            await worker.StopAsync(CancellationToken.None);

            Assert.Contains("ok", generator.Processed);
        }
    }
}
