using RFFM.Api.Domain.Entities.WebPushNotifications;

namespace RFFM.Api.Features.Coaches.Notifications.Services
{
    public enum WebPushSendResult
    {
        Sent,
        SubscriptionGone,
        Failed
    }

    /// <summary>
    /// Sends a single Web Push message to a browser subscription using VAPID.
    /// Never throws for a delivery failure — see design.md Decision 2: a push failure must
    /// never fail the triggering business command. Only a missing/invalid server configuration
    /// (VAPID keys) throws, since that is a deployment error, not a delivery failure.
    /// </summary>
    public interface IWebPushSender
    {
        Task<WebPushSendResult> SendAsync(WebPushSubscription subscription, string payloadJson, CancellationToken ct = default);
    }
}
