using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.LeagueSquadStats.Services
{
    public interface ILeagueSquadStatsQueue
    {
        ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default);

        IAsyncEnumerable<string> DequeueAllAsync(CancellationToken cancellationToken);
    }

    public class LeagueSquadStatsQueue : ILeagueSquadStatsQueue
    {
        private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });

        public ValueTask EnqueueAsync(string reportId, CancellationToken cancellationToken = default) =>
            _channel.Writer.WriteAsync(reportId, cancellationToken);

        public IAsyncEnumerable<string> DequeueAllAsync(CancellationToken cancellationToken) =>
            _channel.Reader.ReadAllAsync(cancellationToken);
    }

    /// <summary>
    /// Procesa las estadísticas de liga de una en una para no saturar la RFFM.
    /// Al arrancar reencola los informes pendientes o en curso (p. ej. tras un reinicio).
    /// </summary>
    public class LeagueSquadStatsWorker(
        ILeagueSquadStatsQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<LeagueSquadStatsWorker> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await RequeueUnfinishedReportsAsync(stoppingToken);

            await foreach (var reportId in queue.DequeueAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var generator = scope.ServiceProvider.GetRequiredService<ILeagueSquadStatsGenerator>();
                    await generator.GenerateAsync(reportId, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error procesando las estadísticas de liga {ReportId}", reportId);
                }
            }
        }

        private async Task RequeueUnfinishedReportsAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FederationDbContext>();
                var unfinishedStatuses = new[] { LeagueSquadStatsStatus.Pending, LeagueSquadStatsStatus.Running };
                var reportIds = await db.LeagueSquadStatsReports
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
                logger.LogError(ex, "No se pudieron reencolar las estadísticas de liga pendientes");
            }
        }
    }
}
