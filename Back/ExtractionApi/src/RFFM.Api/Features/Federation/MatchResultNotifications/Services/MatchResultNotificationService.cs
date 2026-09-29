using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResultNotifications.Services
{
    public interface IMatchResultNotificationService
    {
        Task RunAsync(CancellationToken cancellationToken);
    }

    /// <summary>
    /// Avisa a cada usuario, una sola vez, del resultado del partido de liga de su equipo principal en cuanto la
    /// RFFM publica el marcador. Las jornadas se refrescan a través de <see cref="IRffmResultsSyncService"/>, así que
    /// la política de refresco limita las llamadas a la RFFM.
    /// </summary>
    public class MatchResultNotificationService(
        FederationDbContext db,
        IRffmResultsSyncService resultsSyncService,
        IWebPushNotificationDispatcher dispatcher,
        TimeProvider timeProvider,
        IOptions<RffmOptions> options,
        ILogger<MatchResultNotificationService> logger) : IMatchResultNotificationService
    {
        private static readonly TimeZoneInfo Madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        private sealed record Candidate(int Round, RffmMatch Match);

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            var followers = await db.FederationSettings
                .AsNoTracking()
                .CurrentPrimaryTeams(options.Value.CurrentSeasonId)
                .Where(s => !db.MatchResultNotificationOptOuts.Any(o => o.UserId == s.UserId))
                .Select(s => new { s.UserId, GroupId = s.GroupId!, TeamId = s.TeamId!, s.CreatedAt })
                .ToListAsync(cancellationToken);

            var followersByGroup = followers
                .GroupBy(f => f.UserId)
                .Select(g => g.OrderByDescending(f => f.CreatedAt).First())
                .GroupBy(f => f.GroupId.Trim());

            foreach (var group in followersByGroup)
            {
                if (!int.TryParse(group.Key, out var groupId))
                    continue;

                var usersByTeam = group
                    .GroupBy(f => f.TeamId.Trim())
                    .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(f => f.UserId).ToList());

                try
                {
                    await NotifyGroupAsync(groupId, usersByTeam, cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
                {
                    logger.LogError(ex, "No se pudieron notificar los resultados del grupo {GroupId}", groupId);
                    db.ChangeTracker.Clear();
                }
            }
        }

        private async Task NotifyGroupAsync(int groupId, IReadOnlyDictionary<string, IReadOnlyList<string>> usersByTeam,
            CancellationToken cancellationToken)
        {
            var groupCode = groupId.ToString();
            var seasonId = options.Value.CurrentSeasonId;

            var group = await LoadGroupAsync(groupCode, cancellationToken);
            if (group == null)
            {
                await resultsSyncService.GetCalendarAsync(groupId, seasonId, cancellationToken);
                group = await LoadGroupAsync(groupCode, cancellationToken);
                if (group == null)
                    return;
            }

            var candidates = await LoadCandidatesAsync(group, usersByTeam.Keys, cancellationToken);
            var roundsAwaitingScore = candidates.Where(c => !HasScore(c.Match)).Select(c => c.Round).Distinct().ToList();
            if (roundsAwaitingScore.Count > 0)
            {
                foreach (var round in roundsAwaitingScore)
                    await resultsSyncService.GetMatchDayAsync(groupId, round, seasonId, cancellationToken);
                candidates = await LoadCandidatesAsync(group, usersByTeam.Keys, cancellationToken);
            }

            foreach (var candidate in candidates.Where(c => HasScore(c.Match)))
            {
                foreach (var (teamCode, userIds) in usersByTeam)
                {
                    var isLocal = candidate.Match.LocalTeamCode == teamCode;
                    var isVisitor = candidate.Match.VisitorTeamCode == teamCode;
                    if (!isLocal && !isVisitor)
                        continue;

                    await NotifyAsync(candidate, teamCode, isLocal, userIds, cancellationToken);
                }
            }
        }

        private async Task NotifyAsync(Candidate candidate, string teamCode, bool isLocal, IReadOnlyList<string> userIds,
            CancellationToken cancellationToken)
        {
            var match = candidate.Match;
            var alreadyNotified = await db.MatchResultNotificationLogs
                .AsNoTracking()
                .Where(l => l.RecordCode == match.RecordCode && userIds.Contains(l.UserId))
                .Select(l => l.UserId)
                .ToListAsync(cancellationToken);

            var pending = userIds.Except(alreadyNotified).ToList();
            if (pending.Count == 0)
                return;

            var now = timeProvider.GetUtcNow().UtcDateTime;
            db.MatchResultNotificationLogs.AddRange(pending.Select(userId =>
                MatchResultNotificationLog.Create(userId, match.RecordCode, teamCode, match.LocalGoals, match.VisitorGoals, now)));
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex)
            {
                // Otro proceso ya ha registrado (y enviado) este aviso.
                logger.LogWarning(ex, "El resultado del partido {RecordCode} ya se había notificado", match.RecordCode);
                db.ChangeTracker.Clear();
                return;
            }

            await dispatcher.DispatchMatchResultAsync(pending,
                new MatchResultMessage(candidate.Round, match.LocalTeamName, match.LocalGoals, match.VisitorTeamName,
                    match.VisitorGoals, isLocal),
                cancellationToken);
        }

        private Task<RffmCompetitionGroup?> LoadGroupAsync(string groupCode, CancellationToken cancellationToken) =>
            db.RffmCompetitionGroups.AsNoTracking().SingleOrDefaultAsync(g => g.GroupCode == groupCode, cancellationToken);

        /// <summary>Partidos de los equipos seguidos que ya han podido terminar dentro de la ventana de notificación.</summary>
        private async Task<List<Candidate>> LoadCandidatesAsync(RffmCompetitionGroup competitionGroup, IEnumerable<string> teamCodes,
            CancellationToken cancellationToken)
        {
            var settings = options.Value.Results;
            var now = timeProvider.GetUtcNow().UtcDateTime;
            var window = TimeSpan.FromHours(settings.ResultNotificationWindowHours);
            var today = ToMadridDate(now);
            var firstDay = ToMadridDate(now - window);
            var codes = teamCodes.ToList();

            var rows = await (
                    from match in db.RffmMatches.AsNoTracking()
                    join round in db.RffmRounds.AsNoTracking() on match.RffmRoundId equals round.Id
                    where round.GroupCode == competitionGroup.GroupCode
                          && (codes.Contains(match.LocalTeamCode) || codes.Contains(match.VisitorTeamCode))
                          && match.MatchDate != null && match.MatchDate >= firstDay && match.MatchDate <= today
                    select new Candidate(round.Number, match))
                .ToListAsync(cancellationToken);

            return rows.Where(c => IsInWindow(c.Match)).ToList();

            bool IsInWindow(RffmMatch match)
            {
                var estimatedEnd = RffmRoundRefreshPolicy.EstimatedEndUtc(match, competitionGroup.MatchMinutes, competitionGroup.MatchParts, settings);
                return estimatedEnd is not { } end || (end <= now && now - end <= window);
            }
        }

        private static bool HasScore(RffmMatch match) =>
            int.TryParse(match.LocalGoals, out _) && int.TryParse(match.VisitorGoals, out _);

        private static DateOnly ToMadridDate(DateTime utc) =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, Madrid));
    }
}
