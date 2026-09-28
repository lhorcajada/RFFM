using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly.CircuitBreaker;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public interface ISquadHistoryGenerator
    {
        Task GenerateAsync(string reportId, CancellationToken cancellationToken);
    }

    public class SquadHistoryGenerator(
        FederationDbContext federationDb,
        AppDbContext appDb,
        IRffmBackgroundClient rffm,
        ISquadCandidateFinder candidateFinder,
        IOptions<RffmOptions> rffmOptions,
        ILogger<SquadHistoryGenerator> logger) : ISquadHistoryGenerator
    {
        public const string ReadyNotificationType = "SquadHistoryReady";
        public const string FailedNotificationType = "SquadHistoryFailed";
        private static readonly TimeSpan CircuitBreakerPause = TimeSpan.FromSeconds(60);

        private sealed record SquadPlayer(string Code, string Name, int? BirthYear, string? OriginTeamName);

        private readonly Dictionary<string, IReadOnlyList<RffmGroupMatch>> _groupMatchesCache = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, MatchRffm?> _actaCache = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<(string PlayerCode, int SeasonId), Player> _prefetchedSheets = new();

        public static string DeepLinkPath(string teamCode, int seasonId) =>
            $"/federation/squad-history/{Uri.EscapeDataString(teamCode)}?seasonId={seasonId}";

        public async Task GenerateAsync(string reportId, CancellationToken cancellationToken)
        {
            var report = await federationDb.SquadHistoryReports
                .Include(r => r.Entries)
                .Include(r => r.Subscribers)
                .SingleOrDefaultAsync(r => r.Id == reportId, cancellationToken);

            var isInProgress = report != null &&
                               (report.Status == SquadHistoryStatus.Pending || report.Status == SquadHistoryStatus.Running);
            if (!isInProgress) return;

            try
            {
                await GenerateReportAsync(report!, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error generando el historial de plantilla {ReportId}", reportId);
                report!.Fail($"Error inesperado al generar el historial ({ex.GetType().Name}).");
                await NotifyAndSaveAsync(report, FailedNotificationType, cancellationToken);
            }
        }

        private async Task GenerateReportAsync(SquadHistoryReport report, CancellationToken cancellationToken)
        {
            var roster = await rffm.GetTeamRosterAsync(report.TeamCode, cancellationToken);
            if (roster == null)
            {
                report.Fail("No se pudo obtener la plantilla del equipo.");
                await NotifyAndSaveAsync(report, FailedNotificationType, cancellationToken);
                return;
            }

            var players = roster.Players
                .Where(p => !string.IsNullOrWhiteSpace(p.PlayerCode))
                .GroupBy(p => p.PlayerCode.Trim())
                .Select(g => new SquadPlayer(g.Key, g.First().Name?.Trim() ?? string.Empty, null, null))
                .ToList();

            if (players.Count > 0)
            {
                report.Start(players.Count);
            }
            else
            {
                var candidates = await FindCandidatesAsync(report, roster, cancellationToken);
                players = candidates.Candidates
                    .Select(c => new SquadPlayer(c.PlayerCode, c.PlayerName, c.BirthYear, c.OriginTeamName))
                    .ToList();
                foreach (var candidate in candidates.Candidates)
                    _prefetchedSheets[(candidate.PlayerCode, report.PreviousSeasonId!.Value)] = candidate.PreviousSeasonSheet;

                report.Start(players.Count);
                report.MarkAsCandidateSquad(candidates.Note);
            }

            await federationDb.SaveChangesAsync(cancellationToken);

            var seasons = new[] { report.SeasonId, report.PreviousSeasonId }
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .ToList();

            var entries = new List<SquadHistoryEntry>();
            foreach (var player in players)
            {
                var playerEntries = await BuildPlayerEntriesWithCircuitRetryAsync(player, seasons, cancellationToken);
                entries.AddRange(playerEntries);
                report.ReportProgress(playerFailed: playerEntries.Any(e => e.IsIncomplete));
                await federationDb.SaveChangesAsync(cancellationToken);
            }

            report.Complete(entries);
            await NotifyAndSaveAsync(report, ReadyNotificationType, cancellationToken);
        }

        private async Task<SquadCandidateSearchResult> FindCandidatesAsync(SquadHistoryReport report, TeamRffm roster,
            CancellationToken cancellationToken)
        {
            var seasonStartYear = FootballCategory.SeasonStartYear(SeasonName(report.SeasonId));
            if (seasonStartYear is null || report.PreviousSeasonId is null)
                return new SquadCandidateSearchResult([], "No se buscan posibles jugadores: no hay temporada anterior configurada.");

            try
            {
                return await candidateFinder.FindAsync(roster, seasonStartYear.Value, report.PreviousSeasonId.Value, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // La búsqueda de candidatos es un extra: si falla, el informe termina vacío con la causa visible.
                logger.LogError(ex, "Error buscando posibles jugadores para el equipo {TeamCode}", report.TeamCode);
                return new SquadCandidateSearchResult([], $"No se pudieron buscar posibles jugadores ({ex.GetType().Name}: {ex.Message}).");
            }
        }

        private async Task<List<SquadHistoryEntry>> BuildPlayerEntriesWithCircuitRetryAsync(
            SquadPlayer player, IReadOnlyList<int> seasons, CancellationToken cancellationToken)
        {
            try
            {
                return await BuildPlayerEntriesAsync(player, seasons, cancellationToken);
            }
            catch (BrokenCircuitException)
            {
                logger.LogWarning("Circuito RFFM abierto; se pausa {Seconds}s antes de reintentar el jugador {PlayerCode}",
                    CircuitBreakerPause.TotalSeconds, player.Code);
                await Task.Delay(CircuitBreakerPause, cancellationToken);
                return await BuildPlayerEntriesAsync(player, seasons, cancellationToken);
            }
        }

        private async Task<List<SquadHistoryEntry>> BuildPlayerEntriesAsync(
            SquadPlayer player, IReadOnlyList<int> seasons, CancellationToken cancellationToken)
        {
            var sheets = new List<(int SeasonId, Player? Sheet)>();
            foreach (var seasonId in seasons)
                sheets.Add((seasonId, await GetSheetAsync(player.Code, seasonId, cancellationToken)));

            var sheetBirthYear = sheets.Select(s => s.Sheet?.BirthYear ?? 0).FirstOrDefault(year => year > 0);
            var sheetName = sheets.Select(s => s.Sheet?.Name).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name));
            var resolved = player with
            {
                Name = string.IsNullOrWhiteSpace(player.Name) ? sheetName?.Trim() ?? string.Empty : player.Name,
                BirthYear = player.BirthYear ?? (sheetBirthYear > 0 ? sheetBirthYear : null)
            };

            var entries = new List<SquadHistoryEntry>();
            foreach (var (seasonId, sheet) in sheets)
                entries.AddRange(await BuildSeasonEntriesAsync(resolved, seasonId, sheet, cancellationToken));
            return entries;
        }

        private async Task<Player?> GetSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken)
        {
            if (_prefetchedSheets.TryGetValue((playerCode, seasonId), out var prefetched)) return prefetched;

            try
            {
                return await rffm.GetPlayerSheetAsync(playerCode, seasonId, cancellationToken);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverable(ex))
            {
                logger.LogWarning(ex, "No se pudo obtener la ficha del jugador {PlayerCode} en la temporada {SeasonId}", playerCode, seasonId);
                return null;
            }
        }

        private async Task<List<SquadHistoryEntry>> BuildSeasonEntriesAsync(
            SquadPlayer player, int seasonId, Player? sheet, CancellationToken cancellationToken)
        {
            if (sheet == null)
                return [UnavailableEntry(player, seasonId)];

            var participations = sheet.Competitions
                .Where(c => !string.IsNullOrWhiteSpace(c.TeamCode))
                .GroupBy(c => (c.TeamCode.Trim(), c.GroupCode.Trim()))
                .Select(g => g.First())
                .ToList();

            if (participations.Count == 1)
                return [FromSheetTotals(player, seasonId, participations[0], sheet)];

            var entries = new List<SquadHistoryEntry>();
            foreach (var participation in participations)
                entries.Add(await FromActasAsync(player, seasonId, participation, cancellationToken));
            return entries;
        }

        private SquadHistoryEntry FromSheetTotals(SquadPlayer player, int seasonId,
            CompetitionParticipation participation, Player sheet) =>
            CreateEntry(player, seasonId, participation,
                goals: sheet.Matches.TotalGoals,
                yellowCards: sheet.Cards.Yellow,
                redCards: sheet.Cards.Red + sheet.Cards.DoubleYellow,
                starts: sheet.Matches.Starter,
                callUps: sheet.Matches.Called,
                source: SquadHistorySource.PlayerSheet,
                isIncomplete: false);

        private async Task<SquadHistoryEntry> FromActasAsync(SquadPlayer player, int seasonId,
            CompetitionParticipation participation, CancellationToken cancellationToken)
        {
            var teamCode = participation.TeamCode.Trim();
            var groupCode = participation.GroupCode.Trim();
            try
            {
                var teamMatches = (await GetGroupMatchesAsync(groupCode, cancellationToken))
                    .Where(m => SameCode(m.LocalTeamCode, teamCode) || SameCode(m.VisitorTeamCode, teamCode))
                    .ToList();

                var actas = new List<MatchRffm>();
                var missingActas = false;
                foreach (var match in teamMatches)
                {
                    var acta = await GetActaAsync(match.RecordCode, seasonId, participation.CompetitionCode.Trim(), groupCode, cancellationToken);
                    if (acta == null) missingActas = true;
                    else actas.Add(acta);
                }

                var stats = SquadHistoryActaAggregator.Aggregate(player.Code, teamCode, actas);
                return CreateEntry(player, seasonId, participation,
                    stats.Goals, stats.YellowCards, stats.RedCards, stats.Starts, stats.CallUps,
                    SquadHistorySource.Actas, isIncomplete: missingActas);
            }
            catch (Exception ex) when (RffmErrors.IsRecoverable(ex))
            {
                logger.LogWarning(ex, "No se pudieron obtener las actas del equipo {TeamCode} para el jugador {PlayerCode}", teamCode, player.Code);
                return CreateEntry(player, seasonId, participation, 0, 0, 0, null, null,
                    SquadHistorySource.Actas, isIncomplete: true);
            }
        }

        private async Task<IReadOnlyList<RffmGroupMatch>> GetGroupMatchesAsync(string groupCode, CancellationToken cancellationToken)
        {
            if (_groupMatchesCache.TryGetValue(groupCode, out var cached)) return cached;
            var matches = await rffm.GetGroupPlayedMatchesAsync(groupCode, cancellationToken);
            _groupMatchesCache[groupCode] = matches;
            return matches;
        }

        private async Task<MatchRffm?> GetActaAsync(string recordCode, int seasonId, string competitionCode, string groupCode,
            CancellationToken cancellationToken)
        {
            if (_actaCache.TryGetValue(recordCode, out var cached)) return cached;
            var acta = await rffm.GetActaAsync(recordCode, seasonId, competitionCode, groupCode, cancellationToken);
            _actaCache[recordCode] = acta;
            return acta;
        }

        private SquadHistoryEntry CreateEntry(SquadPlayer player, int seasonId,
            CompetitionParticipation participation, int goals, int yellowCards, int redCards,
            int? starts, int? callUps, SquadHistorySource source, bool isIncomplete) =>
            SquadHistoryEntry.Create(
                player.Code, player.Name, seasonId, SeasonName(seasonId),
                participation.CompetitionCode, participation.CompetitionName,
                participation.GroupCode, participation.GroupName,
                participation.TeamCode, participation.TeamName, participation.ClubName,
                string.IsNullOrWhiteSpace(participation.TeamShieldUrl) ? null : participation.TeamShieldUrl,
                participation.TeamPoints, participation.TeamPosition,
                goals, yellowCards, redCards, starts, callUps, source, isIncomplete,
                player.BirthYear, player.OriginTeamName);

        private SquadHistoryEntry UnavailableEntry(SquadPlayer player, int seasonId) =>
            SquadHistoryEntry.Create(
                player.Code, player.Name, seasonId, SeasonName(seasonId),
                string.Empty, string.Empty, string.Empty, string.Empty,
                string.Empty, string.Empty, string.Empty, null,
                0, 0, 0, 0, 0, null, null, SquadHistorySource.PlayerSheet, isIncomplete: true,
                player.BirthYear, player.OriginTeamName);

        private string SeasonName(int seasonId) =>
            rffmOptions.Value.SelectableSeasons.FirstOrDefault(s => s.Id == seasonId)?.Label ?? seasonId.ToString();

        private async Task NotifyAndSaveAsync(SquadHistoryReport report, string notificationType, CancellationToken cancellationToken)
        {
            var isReady = notificationType == ReadyNotificationType;
            var teamLabel = string.IsNullOrWhiteSpace(report.TeamName) ? "la plantilla" : report.TeamName;
            var title = isReady ? "Historial de plantilla listo" : "No se pudo generar el historial";
            var body = isReady
                ? $"Ya puedes consultar el historial de {teamLabel}."
                : $"Ha fallado la generación del historial de {teamLabel}. Inténtalo de nuevo.";
            var deepLink = DeepLinkPath(report.TeamCode, report.SeasonId);

            foreach (var userId in report.TakePendingNotifications())
                appDb.Notifications.Add(Notification.Create(userId, notificationType, title, body, deepLink));

            // Primero las notificaciones: si falla el segundo guardado, se prefiere un aviso duplicado a uno perdido.
            await appDb.SaveChangesAsync(cancellationToken);
            await federationDb.SaveChangesAsync(cancellationToken);
        }

        private static bool SameCode(string? a, string? b) =>
            !string.IsNullOrWhiteSpace(a) && string.Equals(a.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
