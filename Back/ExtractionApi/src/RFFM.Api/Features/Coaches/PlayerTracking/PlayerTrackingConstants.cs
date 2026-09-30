using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    public static class PlayerTrackingConstants
    {
        public const string Tag = "PlayerTracking";
    }

    internal static class PlayerTrackingGuards
    {
        public static async Task EnsurePlayerInTeamAsync(AppDbContext db, string teamId, string teamPlayerId, CancellationToken cancellationToken)
        {
            var playerInTeam = await db.TeamPlayers
                .AsNoTracking()
                .AnyAsync(tp => tp.Id == teamPlayerId && tp.TeamId == teamId, cancellationToken);

            if (!playerInTeam)
                throw new NotFoundException($"TeamPlayer '{teamPlayerId}' Not Found", ErrorCodes.TeamPlayerNotFound);
        }
    }
}
