using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Elimina el seguimiento de un jugador en una sesión. Solo el entrenador.
    /// DELETE /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}
    /// </summary>
    public class DeleteSessionEvaluation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}",
                    async (string teamId, string teamPlayerId, string sessionId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command { TeamId = teamId, TeamPlayerId = teamPlayerId, SessionId = sessionId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSessionEvaluation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string SessionId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "ReadWrite";
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.SessionId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<Command, Unit>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var evaluation = await db.PlayerSessionEvaluations
                    .SingleOrDefaultAsync(e => e.TeamId == request.TeamId
                        && e.TeamPlayerId == request.TeamPlayerId
                        && e.TrainingSessionId == request.SessionId, cancellationToken)
                    ?? throw new NotFoundException($"SessionEvaluation for '{request.SessionId}' Not Found", ErrorCodes.SessionEvaluationNotFound);

                db.PlayerSessionEvaluations.Remove(evaluation);
                await db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
