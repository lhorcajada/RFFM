using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// Registers every team player injured for the event (injury started before the event day and
    /// still open) who has no convocation yet as "Desconvocado" with reason "Lesión". Idempotent:
    /// the attendance page calls it on every load, so repeated or concurrent calls must never
    /// create a second convocation for the same player.
    /// </summary>
    public class DeconvokeInjuredPlayers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/convocations/injured-deconvocations",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new Command(eventId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeconvokeInjuredPlayers))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Command(string EventId) : IRequest<Unit>;

        public class Handler : IRequestHandler<Command, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ISanctionConvocationEnforcementService _enforcementService;

            public Handler(AppDbContext db, ISanctionConvocationEnforcementService enforcementService)
            {
                _db = db;
                _enforcementService = enforcementService;
            }

            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents.AsNoTracking()
                    .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken)
                    ?? throw new NotFoundException("Evento no encontrado", ErrorCodes.SportEventNotFound);

                var eventDate = sportEvent.EveDateTime?.Date ?? DateTime.UtcNow.Date;

                var injuredWithoutConvocation = await _db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == sportEvent.TeamId)
                    .Where(tp => !_db.Convocations.Any(c => c.SportEventId == request.EventId && c.TeamPlayerId == tp.Id))
                    .Where(tp => tp.Injuries.Any(i =>
                        i.StartDate.Date < eventDate &&
                        (i.EndDate == null || i.EndDate.Value.Date >= eventDate)))
                    .Select(tp => tp.Id)
                    .ToListAsync(cancellationToken);

                if (injuredWithoutConvocation.Count == 0) return Unit.Value;

                foreach (var teamPlayerId in injuredWithoutConvocation)
                {
                    await _enforcementService.ForceDeconvocationAsync(
                        teamPlayerId, request.EventId, ExcuseTypes.Injury.Id, cancellationToken);
                }

                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException ex) when (ex.IsUniqueViolation())
                {
                    // A concurrent call already registered these players.
                    _db.ChangeTracker.Clear();
                }

                return Unit.Value;
            }
        }
    }
}
