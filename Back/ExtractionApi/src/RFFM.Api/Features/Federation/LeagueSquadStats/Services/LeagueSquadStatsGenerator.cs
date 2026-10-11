using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly.CircuitBreaker;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.LeagueSquadStats.Services
{
    public interface ILeagueSquadStatsGenerator
    {
        Task GenerateAsync(string reportId, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Recorre equipos del grupo → plantilla → ficha de cada jugador y persiste los totales por
    /// temporada. La temporada actual se pide siempre; la anterior solo si aún no está guardada.
    /// </summary>
    public class LeagueSquadStatsGenerator(
        FederationDbContext db,
        IRffmBackgroundClient rffm,
        IWebPushNotificationDispatcher notifications,
        TimeProvider timeProvider,
        IOptions<RffmOptions> rffmOptions,
        ILogger<LeagueSquadStatsGenerator> logger) : ILeagueSquadStatsGenerator
    {
        public const string GroupTeamsUnavailableMessage = "No se pudieron obtener los equipos del grupo.";
        private const int SaveEveryPlayers = 10;
        private static readonly TimeSpan CircuitBreakerPause = TimeSpan.FromSeconds(60);

        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        public async Task GenerateAsync(string reportId, CancellationToken cancellationToken)
        {
            var report = await db.LeagueSquadStatsReports
                .Include(r => r.Teams).ThenInclude(t => t.Players)
                .Include(r => r.Subscribers)
                .SingleOrDefaultAsync(r => r.Id == reportId, cancellationToken);

            if (report is not { IsInProgress: true }) return;

            try
            {
                await GenerateReportAsync(report, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error generando las estadísticas de liga {ReportId}", reportId);
                report.Fail($"Error inesperado al generar las estadísticas ({ex.GetType().Name}).");
                await SaveAndNotifyAsync(report, succeeded: false, cancellationToken);
            }
        }

        private async Task GenerateReportAsync(LeagueSquadStatsReport report, CancellationToken cancellationToken)
        {
            report.Start(UtcNow);
            await db.SaveChangesAsync(cancellationToken);

            var groupTeams = await GetGroupTeamsOrEmptyAsync(report.GroupCode, cancellationToken);
            if (groupTeams.Count == 0)
            {
                report.Fail(GroupTeamsUnavailableMessage);
                await SaveAndNotifyAsync(report, succeeded: false, cancellationToken);
                return;
            }

            var squads = new List<LeagueSquadTeamData>();
            foreach (var groupTeam in groupTeams)
                squads.Add(await BuildSquadAsync(report, groupTeam, cancellationToken));

            var players = squads
                .SelectMany(s => s.Players)
                .GroupBy(p => p.PlayerCode)
                .Select(g => g.First())
                .ToList();
            report.SetTotals(players.Count);
            await db.SaveChangesAsync(cancellationToken);

            var seasons = new List<int> { report.SeasonId };
            if (report.PreviousSeasonId.HasValue) seasons.Add(report.PreviousSeasonId.Value);
            var playerCodes = players.Select(p => p.PlayerCode).ToList();
            var stored = (await db.RffmPlayerSeasonStats
                    .Where(s => playerCodes.Contains(s.PlayerCode) && seasons.Contains(s.SeasonId))
                    .ToListAsync(cancellationToken))
                .ToDictionary(s => (s.PlayerCode, s.SeasonId));

            foreach (var player in players)
            {
                var currentSeasonSaved = await RefreshSeasonAsync(player, report.SeasonId, stored, cancellationToken);

                var mustFetchPreviousSeason = report.PreviousSeasonId.HasValue &&
                                              NeedsPreviousSeason(report, stored.GetValueOrDefault((player.PlayerCode, report.PreviousSeasonId.Value)));
                if (mustFetchPreviousSeason)
                    await RefreshSeasonAsync(player, report.PreviousSeasonId!.Value, stored, cancellationToken);

                report.RegisterPlayerProcessed(failed: !currentSeasonSaved);
                if (report.ProcessedPlayers % SaveEveryPlayers == 0)
                    await db.SaveChangesAsync(cancellationToken);
            }

            report.ReplaceSquads(squads);
            report.Complete(UtcNow);
            await SaveAndNotifyAsync(report, succeeded: true, cancellationToken);
        }

        /// <summary>
        /// La temporada pasada se descarga una vez por informe: si la fila es anterior a la creación del
        /// informe, se guardó cuando esa temporada aún estaba en juego y puede estar incompleta.
        /// </summary>
        private static bool NeedsPreviousSeason(LeagueSquadStatsReport report, RffmPlayerSeasonStats? storedPreviousSeason) =>
            storedPreviousSeason == null || storedPreviousSeason.FetchedAt < report.CreatedAt;

        private async Task<IReadOnlyList<RffmGroupTeam>> GetGroupTeamsOrEmptyAsync(string groupCode, CancellationToken cancellationToken)
        {
            try
            {
                return await rffm.GetGroupTeamsAsync(groupCode, cancellationToken);
            }
            catch (Exception ex) when (ex is HttpRequestException or BrokenCircuitException)
            {
                logger.LogWarning(ex, "La RFFM no ha devuelto los equipos del grupo {GroupCode}", groupCode);
                return [];
            }
        }

        private async Task<LeagueSquadTeamData> BuildSquadAsync(LeagueSquadStatsReport report, RffmGroupTeam groupTeam,
            CancellationToken cancellationToken)
        {
            var previous = report.Teams.FirstOrDefault(t => t.TeamCode == groupTeam.TeamCode);
            var roster = await WithRffmFailureAsNullAsync(() => rffm.GetTeamRosterAsync(groupTeam.TeamCode, cancellationToken), cancellationToken);
            if (roster == null)
            {
                logger.LogWarning("La RFFM no ha devuelto la plantilla del equipo {TeamCode}; se mantiene la anterior", groupTeam.TeamCode);
                var previousPlayers = (previous?.Players ?? [])
                    .Select(p => new LeagueSquadPlayerData(p.PlayerCode, p.PlayerName))
                    .ToList();
                return new LeagueSquadTeamData(groupTeam.TeamCode, groupTeam.TeamName, previous?.ShieldUrl, previousPlayers);
            }

            var players = roster.Players
                .Where(p => !string.IsNullOrWhiteSpace(p.PlayerCode))
                .GroupBy(p => p.PlayerCode.Trim())
                .Select(g => new LeagueSquadPlayerData(g.Key, g.First().Name?.Trim() ?? string.Empty))
                .ToList();
            var teamName = string.IsNullOrWhiteSpace(groupTeam.TeamName) ? roster.TeamName : groupTeam.TeamName;
            return new LeagueSquadTeamData(groupTeam.TeamCode, teamName, roster.ClubShield, players);
        }

        /// <returns>false si no se pudo obtener la ficha; en ese caso se conserva lo que hubiera guardado.</returns>
        private async Task<bool> RefreshSeasonAsync(LeagueSquadPlayerData player, int seasonId,
            Dictionary<(string PlayerCode, int SeasonId), RffmPlayerSeasonStats> stored, CancellationToken cancellationToken)
        {
            var sheet = await GetSheetAsync(player.PlayerCode, seasonId, cancellationToken);
            if (sheet == null) return false;

            if (string.IsNullOrWhiteSpace(sheet.Name)) sheet.Name = player.PlayerName;
            var totals = PlayerSeasonTotalsMapper.From(sheet);

            if (stored.TryGetValue((player.PlayerCode, seasonId), out var existing))
            {
                existing.Update(totals, UtcNow);
                return true;
            }

            var created = RffmPlayerSeasonStats.Create(player.PlayerCode, seasonId, totals, UtcNow);
            db.RffmPlayerSeasonStats.Add(created);
            stored[(player.PlayerCode, seasonId)] = created;
            return true;
        }

        /// <summary>La RFFM responde a veces con la ficha vacía aunque el jugador exista: se reintenta una vez.</summary>
        private async Task<Player?> GetSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken)
        {
            var sheet = await WithRffmFailureAsNullAsync(() => rffm.GetPlayerSheetAsync(playerCode, seasonId, cancellationToken), cancellationToken);
            if (sheet != null) return sheet;

            await Task.Delay(TimeSpan.FromMilliseconds(rffmOptions.Value.LeagueSquadStats.EmptySheetRetryDelayMs), cancellationToken);
            return await WithRffmFailureAsNullAsync(() => rffm.GetPlayerSheetAsync(playerCode, seasonId, cancellationToken), cancellationToken);
        }

        private async Task<T?> WithRffmFailureAsNullAsync<T>(Func<Task<T?>> request, CancellationToken cancellationToken) where T : class
        {
            try
            {
                return await request();
            }
            catch (BrokenCircuitException)
            {
                logger.LogWarning("Circuito RFFM abierto; se pausa {Seconds}s", CircuitBreakerPause.TotalSeconds);
                await Task.Delay(CircuitBreakerPause, cancellationToken);
                return null;
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Error de red consultando la RFFM");
                return null;
            }
        }

        private async Task SaveAndNotifyAsync(LeagueSquadStatsReport report, bool succeeded, CancellationToken cancellationToken)
        {
            var recipients = report.TakePendingNotifications()
                .Select(r => new RivalStatsRecipient(r.UserId, r.TeamId))
                .ToList();
            await db.SaveChangesAsync(cancellationToken);

            if (recipients.Count > 0)
                await notifications.DispatchRivalStatsFinishedAsync(recipients, succeeded, cancellationToken);
        }
    }
}
