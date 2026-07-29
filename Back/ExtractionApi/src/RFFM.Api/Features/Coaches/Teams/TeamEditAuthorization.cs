using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams
{
    public static class TeamEditAuthorization
    {
        public static async Task<bool> CanEditAsync(
            AppDbContext db, string? userId, string teamId, string clubId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(userId))
                return false;

            var isClubManager = await db.UserClubs.AnyAsync(uc =>
                uc.ApplicationUserId == userId &&
                uc.ClubId == clubId &&
                (uc.RoleId == Membership.Directive.Id || uc.RoleId == Membership.Coach.Id),
                cancellationToken);
            if (isClubManager)
                return true;

            return await db.UserTeams.AnyAsync(ut =>
                ut.ApplicationUserId == userId &&
                ut.TeamId == teamId &&
                ut.RoleId == Membership.Coach.Id,
                cancellationToken);
        }

        // Para GetTeams: evita N consultas, una sola query para todos los equipos del usuario
        public static async Task<HashSet<string>> CoachTeamIdsAsync(
            AppDbContext db, string? userId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(userId))
                return new HashSet<string>();

            var teamIds = await db.UserTeams
                .Where(ut => ut.ApplicationUserId == userId && ut.RoleId == Membership.Coach.Id)
                .Select(ut => ut.TeamId)
                .ToListAsync(cancellationToken);

            return teamIds.ToHashSet();
        }
    }
}
