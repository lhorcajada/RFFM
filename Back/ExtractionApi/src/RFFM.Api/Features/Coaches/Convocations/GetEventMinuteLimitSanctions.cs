using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    // Same rationale as SetPlayerSanction.cs: a simple read projection with no command
    // semantics, exposed as an inline Minimal API handler (design.md Decisión 9).
    public class GetEventMinuteLimitSanctions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/sanctions/minute-limits",
                async (string eventId, AppDbContext db, CancellationToken ct) =>
                {
                    var sanctions = await db.TeamPlayerSanctions
                        .AsNoTracking()
                        .Where(s =>
                            s.TargetEventId == eventId &&
                            s.SportivePunishmentType == SanctionSportivePunishmentType.MinutesLimit &&
                            s.EndDate == null)
                        .Select(s => new MinuteLimitSanctionResponse(s.TeamPlayerId, s.Id, s.MinutesLimit!.Value))
                        .ToListAsync(ct);

                    return Results.Ok(sanctions);
                })
            .WithName("GetEventMinuteLimitSanctions")
            .WithTags("Convocations")
            .Produces<MinuteLimitSanctionResponse[]>()
            .RequireAuthorization();
        }

        public record MinuteLimitSanctionResponse(string TeamPlayerId, string SanctionId, int MinutesLimit);
    }
}
