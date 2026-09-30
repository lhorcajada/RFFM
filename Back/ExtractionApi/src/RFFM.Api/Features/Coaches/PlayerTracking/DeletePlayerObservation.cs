using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Elimina una observación de un jugador. Solo cuerpo técnico.
    /// DELETE /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}
    /// See openspec/changes/player-tracking-edit-delete/design.md → D2.
    /// </summary>
    public class DeletePlayerObservation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}",
                    async (string teamId, string teamPlayerId, string observationId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command { TeamId = teamId, TeamPlayerId = teamPlayerId, ObservationId = observationId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeletePlayerObservation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string ObservationId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.ObservationId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<Command, Unit>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var observation = await PlayerTrackingGuards.FindObservationAsync(
                    db, request.TeamId, request.TeamPlayerId, request.ObservationId, cancellationToken);

                db.PlayerModelObservations.Remove(observation);
                await db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
