using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Features.Coaches.SportEvents.Queries;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class UpdateEventKit : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/events/{eventId}/kit",
                    async (string eventId, UpdateEventKitRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        if (req.SelectedKitNumber is not null and not (1 or 2))
                            return Results.BadRequest("El número de equipación debe ser 1, 2 o null.");

                        var ev = await db.SportEvents.FirstOrDefaultAsync(e => e.Id == eventId, cancellationToken);
                        if (ev is null) return Results.NotFound();

                        ev.SetSelectedKit(req.SelectedKitNumber);
                        await db.SaveChangesAsync(cancellationToken);

                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateEventKit))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record UpdateEventKitRequest(int? SelectedKitNumber);
}
