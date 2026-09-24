namespace RFFM.Api.Features.Coaches.Notifications.Services
{
    /// <summary>
    /// SPA-only Web Push dispatcher (see openspec/changes/coach-web-push-notifications). Separate
    /// from Mobile's IPushNotificationDispatcher by explicit decision — no shared tables or code.
    /// Every method persists a Notification row per recipient and best-effort sends a Web Push
    /// message; a send failure never fails the triggering business command (design.md Decision 2).
    /// </summary>
    public interface IWebPushNotificationDispatcher
    {
        Task DispatchConvocationCreatedAsync(string teamPlayerId, string eventId, CancellationToken ct = default);
        Task DispatchConvocationStatusChangedAsync(string convocationId, CancellationToken ct = default);
        Task DispatchSanctionChangedAsync(string sanctionId, CancellationToken ct = default);
        Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default);
        Task DispatchInjuryChangedAsync(string injuryId, CancellationToken ct = default);
    }
}
