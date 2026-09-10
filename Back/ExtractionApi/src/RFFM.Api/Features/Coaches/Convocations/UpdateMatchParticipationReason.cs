using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// Sets or clears the free-text reason explaining why a player played fewer minutes than
    /// other participating players, on an already-saved MatchParticipation row. Deliberately
    /// NOT routed through SaveMatchParticipation's full live-match upsert payload — this lets
    /// the frontend edit/clear just the reason without resending scores, cards, substitutions,
    /// etc. for every player. Requires a MatchParticipation row to already exist for the given
    /// (eventId, teamPlayerId); 404s otherwise.
    /// PUT /api/events/{eventId}/match-participation/{teamPlayerId}/reason
    /// </summary>
    public class UpdateMatchParticipationReason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/match-participation/{teamPlayerId}/reason",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, string teamPlayerId, UpdateMatchParticipationReasonRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request = request with { EventId = eventId, TeamPlayerId = teamPlayerId };
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateMatchParticipationReason))
                .WithTags("MatchParticipation")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record UpdateMatchParticipationReasonRequest : IRequest<Unit>
        {
            public string EventId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string? Reason { get; init; }
        }

        public class Validator : AbstractValidator<UpdateMatchParticipationReasonRequest>
        {
            public Validator()
            {
                RuleFor(x => x.Reason).MaximumLength(500);
            }
        }

        public class Handler : IRequestHandler<UpdateMatchParticipationReasonRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(UpdateMatchParticipationReasonRequest request, CancellationToken cancellationToken = default)
            {
                var participation = await _db.MatchParticipations
                    .FirstOrDefaultAsync(mp => mp.EventId == request.EventId && mp.TeamPlayerId == request.TeamPlayerId, cancellationToken);

                if (participation == null)
                    throw new NotFoundException("Participación en el partido no encontrada", "MatchParticipationNotFound");

                participation.SetMinutesReason(request.Reason);

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
