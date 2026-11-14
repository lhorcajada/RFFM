using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players
{
    /// <summary>
    /// Trait ratings are internal technical staff assessments: only an administrator or a coach who
    /// can manage the team may read or write them (never players or family members).
    /// </summary>
    internal static class TeamTraitRatingAccess
    {
        public static async Task<string> EnsureCanManageAsync(
            AppDbContext db,
            ICurrentUserService currentUser,
            string teamId,
            CancellationToken cancellationToken)
        {
            var team = await db.Teams
                .AsNoTracking()
                .Where(t => t.Id == teamId)
                .Select(t => new { t.Id, t.ClubId })
                .FirstOrDefaultAsync(cancellationToken);
            if (team is null)
                throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

            var isAdministrator = (currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => r.Equals("Administrator", StringComparison.OrdinalIgnoreCase));
            var canManageTeam = isAdministrator || await TeamEditAuthorization.CanEditAsync(
                db, currentUser.UserId, team.Id, team.ClubId, cancellationToken);
            if (!canManageTeam)
                throw new ForbiddenAccessException("No tienes permiso para ver ni valorar la conducta de los jugadores de este equipo.");

            return team.Id;
        }
    }
}
