using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
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
            if (coachTeamIds.Contains(eventTeamId))
                return true;

            return await IsClubCoachOfTeamAsync(db, userId, eventTeamId, ct);
        }

        private static Task<bool> IsClubCoachOfTeamAsync(AppDbContext db, string userId, string teamId, CancellationToken ct) =>
            db.UserClubs
                .AsNoTracking()
                .AnyAsync(uc =>
                    uc.ApplicationUserId == userId
                    && uc.RoleId == Membership.Coach.Id
                    && db.Teams.Any(t => t.Id == teamId && t.ClubId == uc.ClubId), ct);
    }
}
