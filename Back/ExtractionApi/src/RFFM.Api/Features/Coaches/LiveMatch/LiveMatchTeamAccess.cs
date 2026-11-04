using Microsoft.EntityFrameworkCore;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public static class LiveMatchTeamAccess
    {
        public static async Task<bool> IsTeamCoachAsync(AppDbContext db, string userId, string eventId, CancellationToken ct)
        {
            var eventTeamId = await db.SportEvents
                .AsNoTracking()
                .Where(se => se.Id == eventId)
                .Select(se => se.TeamId)
                .FirstOrDefaultAsync(ct);

            if (eventTeamId is null)
                return false;

            var coachTeamIds = await TeamEditAuthorization.CoachTeamIdsAsync(db, userId, ct);
            return coachTeamIds.Contains(eventTeamId);
        }
    }
}
