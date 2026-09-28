using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public interface ISquadHistoryQueue
    {
        ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default);

        IAsyncEnumerable<string> DequeueAllAsync(CancellationToken cancellationToken);
    }

    public class SquadHistoryQueue : ISquadHistoryQueue
    {
        private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });

        public ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default) =>
            _channel.Writer.WriteAsync(reportId, cancellationToken);

        public IAsyncEnumerable<string> DequeueAllAsync(CancellationToken cancellationToken) =>
            _channel.Reader.ReadAllAsync(cancellationToken);
    }

    /// <summary>
    /// Procesa los informes de historial de plantilla de uno en uno para no saturar la RFFM.
    /// Al arrancar reencola los informes pendientes o en curso (p. ej. tras un reinicio).
    /// </summary>
    public class SquadHistoryWorker(
        ISquadHistoryQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<SquadHistoryWorker> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await RequeueUnfinishedReportsAsync(stoppingToken);

            await foreach (var reportId in queue.DequeueAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var generator = scope.ServiceProvider.GetRequiredService<ISquadHistoryGenerator>();
                    await generator.GenerateAsync(reportId, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error procesando el historial de plantilla {ReportId}", reportId);
                }
            }
        }

        private async Task RequeueUnfinishedReportsAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FederationDbContext>();
                var unfinishedStatuses = new[] { SquadHistoryStatus.Pending, SquadHistoryStatus.Running };
                var reportIds = await db.SquadHistoryReports
                    .AsNoTracking()
                    .Where(r => unfinishedStatuses.Contains(r.Status))
                    .OrderBy(r => r.RequestedAt)
                    .Select(r => r.Id)
                    .ToListAsync(stoppingToken);

                foreach (var reportId in reportIds)
                    await queue.EnqueueAsync(reportId, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "No se pudieron reencolar los historiales de plantilla pendientes");
            }
        }
    }
}
