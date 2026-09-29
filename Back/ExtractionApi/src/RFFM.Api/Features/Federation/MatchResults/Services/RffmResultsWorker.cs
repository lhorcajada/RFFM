using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    /// <summary>Descarga en segundo plano actas y clasificaciones con el cliente RFFM con reintentos y throttling.</summary>
    public class RffmResultsJobProcessor(
        FederationDbContext db,
        IRffmBackgroundClient client,
        TimeProvider timeProvider,
        ILogger<RffmResultsJobProcessor> logger)
    {
        public Task ProcessAsync(RffmResultsJob job, CancellationToken cancellationToken) => job switch
        {
            FetchMatchRecordJob fetch => FetchMatchRecordAsync(fetch, cancellationToken),
            RefreshStandingsJob standings => RefreshStandingsAsync(standings, cancellationToken),
            _ => Task.CompletedTask
        };

        private async Task FetchMatchRecordAsync(FetchMatchRecordJob job, CancellationToken cancellationToken)
        {
            var alreadyStored = await db.RffmMatchRecords.AnyAsync(r => r.RecordCode == job.RecordCode, cancellationToken);
            if (alreadyStored)
                return;

            var acta = await client.GetActaAsync(job.RecordCode, job.SeasonId, job.CompetitionCode, job.GroupCode, cancellationToken);
            if (acta == null)
            {
                logger.LogWarning("La RFFM no ha devuelto el acta {RecordCode}; se reintentará en el próximo arranque", job.RecordCode);
                return;
            }

            db.RffmMatchRecords.Add(RffmMatchRecord.Create(job.RecordCode, job.GroupCode, JsonSerializer.Serialize(acta),
                timeProvider.GetUtcNow().UtcDateTime));
            await db.SaveChangesAsync(cancellationToken);
        }

        private async Task RefreshStandingsAsync(RefreshStandingsJob job, CancellationToken cancellationToken)
        {
            var group = await db.RffmCompetitionGroups.SingleOrDefaultAsync(g => g.GroupCode == job.GroupCode, cancellationToken);
            if (group == null)
                return;

            var teams = await client.GetStandingsAsync(job.GroupCode, job.Round, cancellationToken);
            if (teams == null || teams.Count == 0)
            {
                logger.LogWarning("La RFFM no ha devuelto la clasificación del grupo {GroupCode}", job.GroupCode);
                return;
            }

            group.UpdateStandings(RffmMatchDayMapper.SerializeStandings(teams), timeProvider.GetUtcNow().UtcDateTime);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>
    /// Procesa los jobs de resultados de uno en uno. Al arrancar encola las actas cerradas que aún no se
    /// han guardado (p. ej. tras un reinicio o un fallo de la RFFM).
    /// </summary>
    public class RffmResultsWorker(
        IRffmResultsJobQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<RffmResultsWorker> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await RequeueMissingMatchRecordsAsync(stoppingToken);

            await foreach (var job in queue.DequeueAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var processor = scope.ServiceProvider.GetRequiredService<RffmResultsJobProcessor>();
                    await processor.ProcessAsync(job, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error procesando el job de resultados {Job}", job);
                }
            }
        }

        private async Task RequeueMissingMatchRecordsAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FederationDbContext>();
                var pending = await (
                        from match in db.RffmMatches.AsNoTracking()
                        join round in db.RffmRounds.AsNoTracking() on match.RffmRoundId equals round.Id
                        join g in db.RffmCompetitionGroups.AsNoTracking() on round.GroupCode equals g.GroupCode
                        where match.RecordClosed == "1"
                              && !db.RffmMatchRecords.Any(r => r.RecordCode == match.RecordCode)
                        select new { match.RecordCode, g.SeasonId, g.CompetitionCode, g.GroupCode })
                    .ToListAsync(stoppingToken);

                foreach (var p in pending)
                    await queue.EnqueueAsync(new FetchMatchRecordJob(p.RecordCode, p.SeasonId, p.CompetitionCode, p.GroupCode), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "No se pudieron reencolar las actas pendientes");
            }
        }
    }
}
