using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.PushNotifications;
using RFFM.Api.Features.Mobile.PushNotifications.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.PushNotifications
{
    public interface IPushNotificationDispatcher
    {
        Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default);
        Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default);
    }

    /// <summary>
    /// Resolves the target audience for a push-worthy event, sends via <see cref="IExpoPushService"/>
    /// and prunes tokens Expo reports as permanently dead. Never lets a send failure bubble up to
    /// the caller (design.md Risk #1: publishing news / writing a calendar event must not fail
    /// because Expo is unreachable).
    /// </summary>
    public class PushNotificationDispatcher : IPushNotificationDispatcher
    {
        private readonly AppDbContext _db;
        private readonly IExpoPushService _expoPushService;
        private readonly ILogger<PushNotificationDispatcher>? _logger;

        public PushNotificationDispatcher(AppDbContext db, IExpoPushService expoPushService, ILogger<PushNotificationDispatcher>? logger = null)
        {
            _db = db;
            _expoPushService = expoPushService;
            _logger = logger;
        }

        public async Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default)
        {
            try
            {
                var tokens = await _db.PushTokens
                    .Where(p => p.NewsEnabled)
                    .ToListAsync(ct);

                if (tokens.Count == 0)
                    return;

                var messages = tokens
                    .Select(t => new ExpoPushMessage(
                        t.ExpoPushToken,
                        "Nueva noticia",
                        "Hay una nueva noticia disponible.",
                        new Dictionary<string, object> { ["type"] = "news", ["id"] = newsId }))
                    .ToList();

                var prunedTokens = await _expoPushService.SendAsync(messages, ct);
                await PruneAsync(tokens, prunedTokens, ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch news-published push notifications for news {NewsId}", newsId);
            }
        }

        public async Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default)
        {
            try
            {
                var clubId = await _db.Teams
                    .Where(t => t.Id == teamId)
                    .Select(t => t.ClubId)
                    .FirstOrDefaultAsync(ct);

                var directUserIdsQuery = _db.Set<UserTeam>()
                    .Where(ut => ut.TeamId == teamId)
                    .Select(ut => ut.ApplicationUserId);

                var userIdsQuery = directUserIdsQuery;
                if (!string.IsNullOrEmpty(clubId))
                {
                    var clubUserIdsQuery = _db.Set<UserClub>()
                        .Where(uc => uc.ClubId == clubId)
                        .Select(uc => uc.ApplicationUserId);
                    userIdsQuery = directUserIdsQuery.Union(clubUserIdsQuery);
                }

                var userIds = await userIdsQuery.Distinct().ToListAsync(ct);
                if (userIds.Count == 0)
                    return;

                var tokens = await _db.PushTokens
                    .Where(p => p.CalendarEnabled && userIds.Contains(p.UserId))
                    .ToListAsync(ct);

                if (tokens.Count == 0)
                    return;

                var messages = tokens
                    .Select(t => new ExpoPushMessage(
                        t.ExpoPushToken,
                        "Calendario actualizado",
                        "Hay un cambio en el calendario de tu equipo.",
                        new Dictionary<string, object> { ["type"] = "calendar", ["id"] = eventId, ["teamId"] = teamId }))
                    .ToList();

                var prunedTokens = await _expoPushService.SendAsync(messages, ct);
                await PruneAsync(tokens, prunedTokens, ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch calendar-changed push notifications for event {EventId}", eventId);
            }
        }

        private async Task PruneAsync(List<PushToken> tokens, IReadOnlyCollection<string> prunedExpoTokens, CancellationToken ct)
        {
            if (prunedExpoTokens.Count == 0)
                return;

            var toRemove = tokens.Where(t => prunedExpoTokens.Contains(t.ExpoPushToken)).ToList();
            if (toRemove.Count == 0)
                return;

            _db.PushTokens.RemoveRange(toRemove);
            await _db.SaveChangesAsync(ct);
        }
    }
}
