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
using static RFFM.Api.Features.Coaches.PlayerTracking.SaveSessionEvaluation;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Seguimiento de un jugador en una sesión. Solo el entrenador.
    /// GET /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}
    /// </summary>
    public class GetSessionEvaluation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}",
                    async (string teamId, string teamPlayerId, string sessionId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId, TeamPlayerId = teamPlayerId, SessionId = sessionId }, ct)))
                .WithName(nameof(GetSessionEvaluation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<SessionEvaluationDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query : IQueryApp<SessionEvaluationDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string SessionId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<Query>
        {
            public Validator()
            {
                RuleFor(q => q.TeamId).NotEmpty();
                RuleFor(q => q.TeamPlayerId).NotEmpty();
                RuleFor(q => q.SessionId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<Query, SessionEvaluationDto>
        {
            public async ValueTask<SessionEvaluationDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var evaluation = await db.PlayerSessionEvaluations
                    .AsNoTracking()
                    .Include(e => e.Subprincipios)
                    .Include(e => e.Comments)
                    .SingleOrDefaultAsync(e => e.TeamId == request.TeamId
                        && e.TeamPlayerId == request.TeamPlayerId
                        && e.TrainingSessionId == request.SessionId, cancellationToken)
                    ?? throw new NotFoundException($"SessionEvaluation for '{request.SessionId}' Not Found", ErrorCodes.SessionEvaluationNotFound);

                return ToDto(evaluation);
            }
        }
    }
}
