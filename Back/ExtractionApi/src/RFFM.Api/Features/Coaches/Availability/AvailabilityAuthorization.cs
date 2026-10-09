using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    internal static class AvailabilityAuthorization
    {
        public static bool IsPlayerOrFamily(ICurrentUserService currentUser) =>
            (currentUser.Roles ?? Enumerable.Empty<string>()).Any(r =>
                r.Equals("Player", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("FamilyMember", StringComparison.OrdinalIgnoreCase));

        public static async Task EnsureCanManageTeamAsync(
            AppDbContext db, ICurrentUserService currentUser, string teamId, string clubId, CancellationToken cancellationToken)
        {
            var isAdministrator = (currentUser.Roles ?? Enumerable.Empty<string>())
                .Any(r => r.Equals("Administrator", StringComparison.OrdinalIgnoreCase));
            var canManageTeam = isAdministrator || await TeamEditAuthorization.CanEditAsync(
                db, currentUser.UserId, teamId, clubId, cancellationToken);
            if (!canManageTeam)
                throw new ForbiddenAccessException("No tienes permiso para gestionar la disponibilidad de este equipo.");
        }

        public static async Task EnsureCanManageEventTeamAsync(
            AppDbContext db, ICurrentUserService currentUser, string teamId, CancellationToken cancellationToken)
        {
            var clubId = await db.Teams
                .Where(t => t.Id == teamId)
                .Select(t => t.ClubId)
                .FirstAsync(cancellationToken);
            await EnsureCanManageTeamAsync(db, currentUser, teamId, clubId, cancellationToken);
        }

        // UserProfile.PlayerId stores the TeamPlayer.Id linked to the account (same rule as UpdateConvocationStatus).
        public static async Task EnsureOwnPlayerAsync(
            AppDbContext db, ICurrentUserService currentUser, string teamPlayerId, CancellationToken cancellationToken)
        {
            var userId = currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");
            var linkedTeamPlayerId = await db.UserProfiles
                .AsNoTracking()
                .Where(p => p.ApplicationUserId == userId)
                .Select(p => p.PlayerId)
                .FirstOrDefaultAsync(cancellationToken);

            var isOwnPlayer = !string.IsNullOrWhiteSpace(linkedTeamPlayerId)
                && string.Equals(linkedTeamPlayerId, teamPlayerId, StringComparison.OrdinalIgnoreCase);
            if (!isOwnPlayer)
                throw new ForbiddenAccessException("No autorizado para responder la disponibilidad de otro jugador.");
        }

        public static async Task<AvailabilityRequest> GetRequestAsync(
            AppDbContext db, string eventId, string requestId, CancellationToken cancellationToken)
            => await db.AvailabilityRequests
                   .Include(r => r.SportEvent)
                   .FirstOrDefaultAsync(r => r.Id == requestId && r.SportEventId == eventId, cancellationToken)
               ?? throw new NotFoundException("Petición de disponibilidad no encontrada.", ErrorCodes.AvailabilityRequestNotFound);

        public static async Task EnsureNotDecidedAsync(
            AppDbContext db, AvailabilityRequest request, CancellationToken cancellationToken)
        {
            var alreadyDecided = await db.Convocations.AnyAsync(
                c => c.SportEventId == request.SportEventId && c.TeamPlayerId == request.TeamPlayerId, cancellationToken);
            if (alreadyDecided)
                throw new ConflictException("La convocatoria de este jugador ya está decidida.", ErrorCodes.AvailabilityAlreadyDecided);
        }
    }
}
