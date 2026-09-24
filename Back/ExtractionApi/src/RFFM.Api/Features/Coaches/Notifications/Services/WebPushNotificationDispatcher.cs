using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.WebPushNotifications;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notifications.Services
{
    public class WebPushNotificationDispatcher : IWebPushNotificationDispatcher
    {
        private readonly AppDbContext _db;
        private readonly IWebPushSender _sender;
        private readonly ILogger<WebPushNotificationDispatcher>? _logger;

        public WebPushNotificationDispatcher(AppDbContext db, IWebPushSender sender, ILogger<WebPushNotificationDispatcher>? logger = null)
        {
            _db = db;
            _sender = sender;
            _logger = logger;
        }

        public async Task DispatchConvocationCreatedAsync(string teamPlayerId, string eventId, CancellationToken ct = default)
        {
            try
            {
                var userIds = await ResolvePlayerAndFamilyUserIdsAsync(teamPlayerId, ct);
                var alias = await GetPlayerAliasAsync(teamPlayerId, ct);
                var sportEvent = await _db.SportEvents.AsNoTracking().FirstOrDefaultAsync(se => se.Id == eventId, ct);

                var body = sportEvent is null
                    ? "Has sido convocado para un próximo evento."
                    : $"{alias} ha sido convocado para {sportEvent.Name}{FormatEventDateSuffix(sportEvent)}.";
                var deepLink = sportEvent is null
                    ? "/coach/convocations/match"
                    : $"/coach/attendance/{sportEvent.Id}";

                await DispatchToUsersAsync(userIds, "ConvocationCreated", "Nueva convocatoria", body, deepLink, ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch convocation-created web push for teamPlayer {TeamPlayerId}", teamPlayerId);
            }
        }

        public async Task DispatchConvocationStatusChangedAsync(string convocationId, CancellationToken ct = default)
        {
            try
            {
                var convocation = await _db.Convocations.FirstOrDefaultAsync(c => c.Id == convocationId, ct);
                if (convocation is null) return;

                var sportEvent = await _db.SportEvents.FirstOrDefaultAsync(se => se.Id == convocation.SportEventId, ct);
                if (sportEvent is null) return;

                var coachUserIds = await ResolveTeamCoachUserIdsAsync(sportEvent.TeamId, ct);
                var alias = await GetPlayerAliasAsync(convocation.TeamPlayerId, ct);

                var body = $"{alias} {ConvocationStatusVerbPhrase(convocation.ConvocationStatusId)} la convocatoria de {sportEvent.Name}{FormatEventDateSuffix(sportEvent)}.";

                await DispatchToUsersAsync(
                    coachUserIds, "ConvocationStatusChanged", "Convocatoria actualizada",
                    body, $"/coach/attendance/{sportEvent.Id}", ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch convocation-status-changed web push for convocation {ConvocationId}", convocationId);
            }
        }

        public async Task DispatchSanctionChangedAsync(string sanctionId, CancellationToken ct = default)
        {
            try
            {
                var sanction = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s => s.Id == sanctionId, ct);
                if (sanction is null) return;

                var userIds = await ResolvePlayerAndFamilyUserIdsAsync(sanction.TeamPlayerId, ct);
                await DispatchToUsersAsync(
                    userIds, "SanctionChanged", "Sanción actualizada",
                    "Hay una actualización en una sanción.", $"/coach/sanctions?highlight={sanctionId}", ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch sanction-changed web push for sanction {SanctionId}", sanctionId);
            }
        }

        public async Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default)
        {
            try
            {
                var userIds = await _db.Set<UserTeam>()
                    .Where(ut => ut.RoleId == Membership.Player.Id || ut.RoleId == Membership.FamilyPlayer.Id)
                    .Select(ut => ut.ApplicationUserId)
                    .Distinct()
                    .ToListAsync(ct);

                await DispatchToUsersAsync(
                    userIds, "NewsPublished", "Nueva noticia",
                    "Hay una nueva noticia disponible.", $"/coach/news/{newsId}", ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch news-published web push for news {NewsId}", newsId);
            }
        }

        public async Task DispatchInjuryChangedAsync(string injuryId, CancellationToken ct = default)
        {
            try
            {
                var injury = await _db.TeamPlayerInjuries.FirstOrDefaultAsync(i => i.Id == injuryId, ct);
                if (injury is null) return;

                var userIds = await ResolvePlayerAndFamilyUserIdsAsync(injury.TeamPlayerId, ct);
                await DispatchToUsersAsync(
                    userIds, "InjuryChanged", "Lesión actualizada",
                    "Hay una actualización en una lesión.", $"/coach/injured?highlight={injuryId}", ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch injury-changed web push for injury {InjuryId}", injuryId);
            }
        }

        private async Task<string> GetPlayerAliasAsync(string teamPlayerId, CancellationToken ct)
        {
            var alias = await _db.TeamPlayers
                .AsNoTracking()
                .Where(tp => tp.Id == teamPlayerId)
                .Select(tp => tp.Player.Alias)
                .FirstOrDefaultAsync(ct);

            return string.IsNullOrWhiteSpace(alias) ? "Un jugador" : alias;
        }

        private static string FormatEventDateSuffix(SportEvent sportEvent)
            => sportEvent.EveDateTime is { } date ? $" el {date:dd/MM/yyyy}" : string.Empty;

        private static string ConvocationStatusVerbPhrase(int? convocationStatusId)
        {
            if (convocationStatusId == ConvocationStatus.FromName("Accepted").Id) return "ha aceptado";
            if (convocationStatusId == ConvocationStatus.FromName("Deconvoke").Id) return "ha rechazado";
            if (convocationStatusId == ConvocationStatus.FromName("Justified").Id) return "ha justificado su ausencia en";
            return "ha actualizado";
        }

        /// <summary>
        /// A coach manages a team either via a per-team UserTeam row (RoleId=Coach) or via
        /// club-wide access (UserClub.RoleId in Coach/Directive, e.g. joined by club invitation
        /// code) — mirrors TeamEditAuthorization.CanEditAsync's "who can manage this team" rule,
        /// so a club-level coach with no explicit UserTeam row still gets notified.
        /// </summary>
        private async Task<List<string>> ResolveTeamCoachUserIdsAsync(string teamId, CancellationToken ct)
        {
            var perTeamCoachIds = await _db.Set<UserTeam>()
                .Where(ut => ut.TeamId == teamId && ut.RoleId == Membership.Coach.Id)
                .Select(ut => ut.ApplicationUserId)
                .ToListAsync(ct);

            var clubId = await _db.Teams
                .Where(t => t.Id == teamId)
                .Select(t => t.ClubId)
                .FirstOrDefaultAsync(ct);

            var clubLevelCoachIds = clubId is null
                ? new List<string>()
                : await _db.Set<UserClub>()
                    .Where(uc => uc.ClubId == clubId && (uc.RoleId == Membership.Coach.Id || uc.RoleId == Membership.Directive.Id))
                    .Select(uc => uc.ApplicationUserId)
                    .ToListAsync(ct);

            return perTeamCoachIds.Concat(clubLevelCoachIds).Distinct().ToList();
        }

        private async Task<List<string>> ResolvePlayerAndFamilyUserIdsAsync(string teamPlayerId, CancellationToken ct)
        {
            var familyUserIds = await _db.TeamPlayerFamilyMembers
                .Where(f => f.TeamPlayerId == teamPlayerId && f.LinkedUserId != null)
                .Select(f => f.LinkedUserId!)
                .ToListAsync(ct);

            var playerUserIds = await _db.Set<UserTeam>()
                .Where(ut => ut.LinkedTeamPlayerId == teamPlayerId && ut.RoleId == Membership.Player.Id)
                .Select(ut => ut.ApplicationUserId)
                .ToListAsync(ct);

            return familyUserIds.Concat(playerUserIds).Distinct().ToList();
        }

        private async Task DispatchToUsersAsync(
            IReadOnlyCollection<string> userIds, string type, string title, string body, string? deepLinkPath, CancellationToken ct)
        {
            if (userIds.Count == 0) return;

            var notifications = userIds
                .Select(userId => Notification.Create(userId, type, title, body, deepLinkPath))
                .ToList();
            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync(ct);

            var subscriptions = await _db.WebPushSubscriptions
                .Where(s => userIds.Contains(s.UserId))
                .ToListAsync(ct);
            if (subscriptions.Count == 0) return;

            var payload = JsonSerializer.Serialize(new { title, body, deepLinkPath });
            var toRemove = new List<WebPushSubscription>();
            foreach (var subscription in subscriptions)
            {
                var result = await _sender.SendAsync(subscription, payload, ct);
                if (result == WebPushSendResult.SubscriptionGone)
                    toRemove.Add(subscription);
            }

            if (toRemove.Count > 0)
            {
                _db.WebPushSubscriptions.RemoveRange(toRemove);
                await _db.SaveChangesAsync(ct);
            }
        }
    }
}
