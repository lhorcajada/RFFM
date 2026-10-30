using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Un ciclo de cierre automático: liquida las jornadas abiertas con todos sus partidos válidos finalizados y abre la
    /// siguiente jornada de los equipos que se han quedado sin ninguna abierta. Cada jornada y cada equipo se procesan en su
    /// propio scope: un fallo se registra y no detiene al resto.
    /// See openspec/changes/quiniela-auto-settle-history/design.md → D2.
    /// </summary>
    internal sealed class QuinielaAutoCloseService(
        IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<QuinielaAutoCloseService> logger)
    {
        public async Task RunAsync(CancellationToken ct)
        {
            foreach (var jornadaId in await OpenJornadaIdsAsync(ct))
                await GuardAsync(() => SettleIfCompleteAsync(jornadaId, ct), "liquidando la jornada {Id}", jornadaId, ct);

            foreach (var teamId in await TeamsWithoutOpenJornadaAsync(ct))
                await GuardAsync(() => OpenNextAsync(teamId, ct), "abriendo la siguiente quiniela del equipo {Id}", teamId, ct);
        }

        private async Task<List<string>> OpenJornadaIdsAsync(CancellationToken ct)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.QuinielaJornadas.AsNoTracking()
                .Where(j => j.Status == QuinielaJornadaStatus.Open)
                .Select(j => j.Id)
                .ToListAsync(ct);
        }

        private async Task<List<string>> TeamsWithoutOpenJornadaAsync(CancellationToken ct)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.QuinielaJornadas.AsNoTracking()
                .GroupBy(j => j.TeamId)
                .Where(g => g.All(j => j.Status == QuinielaJornadaStatus.Settled))
                .Select(g => g.Key)
                .ToListAsync(ct);
        }

        private async Task SettleIfCompleteAsync(string jornadaId, CancellationToken ct)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var federationDb = scope.ServiceProvider.GetRequiredService<FederationDbContext>();

            var jornada = await db.QuinielaJornadas.SingleOrDefaultAsync(j => j.Id == jornadaId, ct);
            if (jornada is null || jornada.Status != QuinielaJornadaStatus.Open)
                return;

            var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, ct);
            if (!round.IsComplete)
                return;

            try
            {
                await QuinielaLifecycle.SettleAsync(db, jornada, round, timeProvider.GetUtcNow().UtcDateTime, ct);
                logger.LogInformation("Quiniela de la jornada {Round} del equipo {Team} liquidada automáticamente", round.Number, jornada.TeamId);
            }
            catch (DomainException ex) when (ex.Code == ErrorCodes.QuinielaAlreadySettled)
            {
            }
        }

        private async Task OpenNextAsync(string teamId, CancellationToken ct)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var federationDb = scope.ServiceProvider.GetRequiredService<FederationDbContext>();

            var opened = await QuinielaLifecycle.OpenNextAsync(db, federationDb, teamId, timeProvider.GetUtcNow().UtcDateTime, ct);
            if (opened is not null)
                logger.LogInformation("Quiniela de la jornada {Round} del equipo {Team} abierta automáticamente", opened.RoundNumber, teamId);
        }

        private async Task GuardAsync(Func<Task> work, string message, string id, CancellationToken ct)
        {
            try
            {
                await work();
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                logger.LogError(ex, "Error " + message, id);
            }
        }
    }
}
