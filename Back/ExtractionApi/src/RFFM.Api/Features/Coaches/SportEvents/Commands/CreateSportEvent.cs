using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class CreateSportEvent : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/sport-events",
                    async (CreateSportEventRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var resolvedRivalId = req.RivalId != null
                            ? (await db.Rivals.Select(r => r.Id).ToListAsync(cancellationToken))
                                .FirstOrDefault(id => id.Trim() == req.RivalId.Trim()) ?? req.RivalId
                            : null;

                        var ev = SportEvent.CreateNew(
                            req.Name,
                            DateTime.SpecifyKind(req.EveDateTime, DateTimeKind.Utc),
                            DateTime.SpecifyKind(req.StartTime ?? req.EveDateTime, DateTimeKind.Utc),
                            req.EndTime.HasValue ? DateTime.SpecifyKind(req.EndTime.Value, DateTimeKind.Utc) : null,
                            req.ArrivalDate.HasValue ? DateTime.SpecifyKind(req.ArrivalDate.Value, DateTimeKind.Utc) : null,
                            req.Location,
                            req.Description,
                            req.EventTypeId,
                            req.TeamId,
                            resolvedRivalId,
                            req.IsHomeMatch ?? true,
                            req.CodActa
                        );

                        db.SportEvents.Add(ev);
                        await db.SaveChangesAsync(cancellationToken);

                        return Results.Ok(new SportEventSaveResponse(ev.Id, ev.Name, ev.EveDateTime, ev.StartTime, ev.EndTime, ev.ArrivalDate, ev.Location, ev.Description, ev.EventTypeId, ev.TeamId, ev.RivalId, ev.IsHomeMatch, ev.CodActa));
                    })
                .WithName(nameof(CreateSportEvent))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SportEventSaveResponse>()
                .Produces(StatusCodes.Status400BadRequest);
        }
    }

    public record CreateSportEventRequest(
        string Name,
        DateTime EveDateTime,
        DateTime? StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? Description,
        int EventTypeId,
        string TeamId,
        string? RivalId,
        bool? IsHomeMatch,
        string? CodActa
    );

    public class CreateSportEventValidator : AbstractValidator<CreateSportEventRequest>
    {
        public CreateSportEventValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.EventTypeId).GreaterThan(0);
        }
    }

    public record SportEventSaveResponse(
        string Id,
        string Name,
        DateTime EveDateTime,
        DateTime StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? Description,
        int EventTypeId,
        string TeamId,
        string? RivalId,
        bool IsHomeMatch,
        string? CodActa
    );
}
