using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Availability;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationProposals
{
    /// <summary>Propuesta guardada: los jugadores que saldrían, en orden.</summary>
    public record SavedDeconvocationProposalDto(string Id, string Name, IReadOnlyList<string> TeamPlayerIds, DateTime CreatedOn);

    public record SavedDeconvocationProposalsDto(IReadOnlyList<SavedDeconvocationProposalDto> Items);

    public static class DeconvocationProposalsConstants
    {
        public const string BaseRoute = "/api/events/{eventId}/deconvocation-proposals";
        public const string Tag = "DeconvocationProposals";
        public const string Roles = "Coach,Administrator";
    }

    internal static class DeconvocationProposalsSupport
    {
        /// <summary>Devuelve el equipo del partido si el usuario puede gestionarlo.</summary>
        public static async Task<string> RequireManagedEventTeamAsync(
            AppDbContext db, ICurrentUserService currentUser, string eventId, CancellationToken ct)
        {
            var teamId = await db.SportEvents.AsNoTracking()
                .Where(e => e.Id == eventId)
                .Select(e => e.TeamId)
                .SingleOrDefaultAsync(ct)
                ?? throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);

            await AvailabilityAuthorization.EnsureCanManageEventTeamAsync(db, currentUser, teamId, ct);
            return teamId;
        }
    }
}
