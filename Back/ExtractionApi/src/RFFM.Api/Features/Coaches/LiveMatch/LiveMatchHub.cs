using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    [Authorize]
    public sealed class LiveMatchHub : Hub
    {
        private readonly AppDbContext _db;

        public LiveMatchHub(AppDbContext db)
        {
            _db = db;
        }

        public static string GroupName(string eventId) => $"liveMatch-{eventId}";

        public async Task JoinMatch(string eventId)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? Context.User?.FindFirst("sub")?.Value;
            var userCanRead = userId is not null
                && await LiveMatchTeamAccess.CanReadAsync(_db, userId, eventId, Context.ConnectionAborted);
            if (!userCanRead)
                throw new HubException("No tienes acceso a este partido en directo.");

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(eventId), Context.ConnectionAborted);
        }

        public Task LeaveMatch(string eventId)
            => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(eventId), Context.ConnectionAborted);
    }
}
