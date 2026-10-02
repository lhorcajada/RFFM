using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Sesiones de la temporada (con fecha) con la asistencia del jugador y el resumen de su seguimiento.
    /// Solo el entrenador.
    /// GET /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations
    /// See openspec/changes/player-session-evaluation-list/design.md → D1.
    /// </summary>
    public class GetPlayerSessionEvaluations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations",
                    async (string teamId, string teamPlayerId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId, TeamPlayerId = teamPlayerId }, ct)))
                .WithName(nameof(GetPlayerSessionEvaluations))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<PlayerSessionListItemDto[]>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query : IQueryApp<PlayerSessionListItemDto[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        public class Validator : AbstractValidator<Query>
        {
            public Validator()
            {
                RuleFor(q => q.TeamId).NotEmpty();
                RuleFor(q => q.TeamPlayerId).NotEmpty();
            }
        }

        public record SessionEvaluationSummaryDto(int Achieved, int Partial, int NotAchieved, DateTime UpdatedAt);

        public record PlayerSessionListItemDto(
            string SessionId,
            string Name,
            DateOnly Date,
            bool IsHeld,
            bool HasCalendarEvent,
            int? AssistanceTypeId,
            SessionEvaluationSummaryDto? Evaluation);

        public class Handler(AppDbContext db) : IRequestHandler<Query, PlayerSessionListItemDto[]>
        {
            public async ValueTask<PlayerSessionListItemDto[]> Handle(Query request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var sessions = await db.TrainingSessions
                    .AsNoTracking()
                    .Where(s => s.TeamId == request.TeamId && s.Date != null)
                    .OrderByDescending(s => s.Date)
                    .Select(s => new { s.Id, s.Name, Date = s.Date!.Value, s.SportEventId })
                    .ToListAsync(cancellationToken);

                var eventIds = sessions.Where(s => s.SportEventId != null).Select(s => s.SportEventId!).Distinct().ToList();
                var attendanceByEvent = await db.Convocations
                    .AsNoTracking()
                    .Where(c => c.TeamPlayerId == request.TeamPlayerId && eventIds.Contains(c.SportEventId))
                    .Select(c => new { c.SportEventId, c.AssistanceTypeId })
                    .ToListAsync(cancellationToken);
                var assistanceByEvent = attendanceByEvent
                    .GroupBy(c => c.SportEventId)
                    .ToDictionary(g => g.Key, g => g.First().AssistanceTypeId);

                var sessionIds = sessions.Select(s => s.Id).ToList();
                var evaluations = await db.PlayerSessionEvaluations
                    .AsNoTracking()
                    .Where(e => e.TeamPlayerId == request.TeamPlayerId && e.TrainingSessionId != null && sessionIds.Contains(e.TrainingSessionId))
                    .Select(e => new
                    {
                        SessionId = e.TrainingSessionId!,
                        e.UpdatedAt,
                        Assessments = e.Subprincipios.Select(s => s.Assessment).ToList(),
                        CommentAssessments = e.Comments.Select(c => c.Assessment).ToList()
                    })
                    .ToListAsync(cancellationToken);
                var evaluationBySession = evaluations.ToDictionary(
                    e => e.SessionId,
                    e => new { e.UpdatedAt, Assessments = e.Assessments.Concat(e.CommentAssessments).ToList() });

                var today = DateTime.UtcNow.Date;
                return sessions
                    .Select(s =>
                    {
                        var evaluation = evaluationBySession.TryGetValue(s.Id, out var e)
                            ? new SessionEvaluationSummaryDto(
                                e.Assessments.Count(a => a == ObservationAssessment.Achieved),
                                e.Assessments.Count(a => a == ObservationAssessment.Partial),
                                e.Assessments.Count(a => a == ObservationAssessment.NotAchieved),
                                e.UpdatedAt)
                            : null;
                        var assistanceTypeId = s.SportEventId is not null && assistanceByEvent.TryGetValue(s.SportEventId, out var a) ? a : null;
                        return new PlayerSessionListItemDto(
                            s.Id, s.Name, DateOnly.FromDateTime(s.Date), s.Date.Date <= today,
                            s.SportEventId is not null, assistanceTypeId, evaluation);
                    })
                    .ToArray();
            }
        }
    }
}
