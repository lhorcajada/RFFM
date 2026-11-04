using Microsoft.AspNetCore.SignalR;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public interface ILiveMatchBroadcaster
    {
        Task BroadcastUpdatedAsync(string eventId, LiveMatchStateResponse state, CancellationToken ct);
        Task BroadcastDeletedAsync(string eventId, CancellationToken ct);
    }

    public sealed class LiveMatchBroadcaster(IHubContext<LiveMatchHub> hub) : ILiveMatchBroadcaster
    {
        public Task BroadcastUpdatedAsync(string eventId, LiveMatchStateResponse state, CancellationToken ct)
            => hub.Clients.Group(LiveMatchHub.GroupName(eventId)).SendAsync("MatchUpdated", state, ct);

        public Task BroadcastDeletedAsync(string eventId, CancellationToken ct)
            => hub.Clients.Group(LiveMatchHub.GroupName(eventId)).SendAsync("MatchDeleted", eventId, ct);
    }
}
