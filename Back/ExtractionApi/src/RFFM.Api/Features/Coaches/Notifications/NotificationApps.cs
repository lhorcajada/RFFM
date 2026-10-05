using RFFM.Api.Domain.Entities.WebPushNotifications;

namespace RFFM.Api.Features.Coaches.Notifications
{
    /// <summary>
    /// The SPA app a notification belongs to, derived from its deep link: links under /federation/ are
    /// Federation notifications; everything else (including notifications without link) belongs to Coach.
    /// </summary>
    public static class NotificationApps
    {
        public const string Federation = "federation";
        public const string Coach = "coach";

        private const string FederationDeepLinkPrefix = "/federation/";

        public static IQueryable<Notification> ForApp(this IQueryable<Notification> query, string? app) =>
            app?.ToLowerInvariant() switch
            {
                Federation => query.Where(n => n.DeepLinkPath != null && n.DeepLinkPath.StartsWith(FederationDeepLinkPrefix)),
                Coach => query.Where(n => n.DeepLinkPath == null || !n.DeepLinkPath.StartsWith(FederationDeepLinkPrefix)),
                _ => query
            };
    }
}
