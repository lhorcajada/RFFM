using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class UpdateSportEvent : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/sport-events/{id}",
                    async (string id, UpdateSportEventRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var ev = await db.SportEvents.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
                        if (ev is null) return Results.NotFound();

                        ev.Name = req.Name;
                        ev.EveDateTime = DateTime.SpecifyKind(req.EveDateTime, DateTimeKind.Utc);
                        ev.StartTime = DateTime.SpecifyKind(req.StartTime ?? req.EveDateTime, DateTimeKind.Utc);
                        ev.EndTime = req.EndTime.HasValue ? DateTime.SpecifyKind(req.EndTime.Value, DateTimeKind.Utc) : null;
                        ev.ArrivalDate = req.ArrivalDate.HasValue ? DateTime.SpecifyKind(req.ArrivalDate.Value, DateTimeKind.Utc) : null;
                        ev.Location = req.Location;
                        ev.Description = req.Description;
                        ev.EventTypeId = req.EventTypeId;
                        ev.RivalId = req.RivalId;

                        await db.SaveChangesAsync(cancellationToken);

                        return Results.Ok(new SportEventSaveResponse(ev.Id, ev.Name, ev.EveDateTime, ev.StartTime, ev.EndTime, ev.ArrivalDate, ev.Location, ev.Description, ev.EventTypeId, ev.TeamId, ev.RivalId));
                    })
                .WithName(nameof(UpdateSportEvent))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SportEventSaveResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record UpdateSportEventRequest(
        string Name,
        DateTime EveDateTime,
        DateTime? StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? Description,
        int EventTypeId,
        string? RivalId
    );

    public class UpdateSportEventValidator : AbstractValidator<UpdateSportEventRequest>
    {
        public UpdateSportEventValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.EventTypeId).GreaterThan(0);
        }
    }
}
