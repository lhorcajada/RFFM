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
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerTracking
{
    /// <summary>
    /// Crea o sustituye el seguimiento de un jugador en una sesión: una valoración por cada subprincipio
    /// trabajado en ella. Solo el entrenador.
    /// PUT /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}
    /// See openspec/changes/player-session-evaluation-api/design.md → D3.
    /// </summary>
    public class SaveSessionEvaluation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}",
                    async (string teamId, string teamPlayerId, string sessionId, Command command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(
                            command with { TeamId = teamId, TeamPlayerId = teamPlayerId, SessionId = sessionId }, ct)))
                .WithName(nameof(SaveSessionEvaluation))
                .WithTags(PlayerTrackingConstants.Tag)
                .RequireAuthorization(new AuthorizeAttribute { Roles = PlayerTrackingConstants.AllowedRoles })
                .Produces<SessionEvaluationDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record EvaluationItem(string SubprincipioId, string Assessment, string? Comment);

        public record CommentItem(string TrackingCommentId, string Assessment, string? Note);

        public record Command : RFFM.Api.Common.ICommand<SessionEvaluationDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public string SessionId { get; init; } = null!;
            public IReadOnlyList<EvaluationItem> Evaluations { get; init; } = Array.Empty<EvaluationItem>();
            public IReadOnlyList<CommentItem> Comments { get; init; } = Array.Empty<CommentItem>();
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
                RuleFor(c => c)
                    .Must(c => c.Evaluations.Count > 0 || c.Comments.Count > 0)
                    .WithName("evaluations")
                    .WithMessage("Valora al menos un subprincipio o un comentario.");
                RuleFor(c => c.Evaluations)
                    .Must(items => items.Select(i => i.SubprincipioId).Distinct().Count() == items.Count)
                    .WithMessage("Un subprincipio no se puede valorar dos veces en la misma sesión.");
                RuleForEach(c => c.Evaluations).ChildRules(item =>
                {
                    item.RuleFor(i => i.SubprincipioId).NotEmpty();
                    item.RuleFor(i => i.Assessment)
                        .Must(a => ObservationAssessment.TryFromName(a, out _))
                        .WithMessage($"La valoración debe ser una de: {string.Join(", ", ObservationAssessment.List.Select(a => a.Name))}.");
                    item.RuleFor(i => i.Comment).MaximumLength(SubprincipioEvaluation.Rules.CommentMaxLength);
                });
                RuleFor(c => c.Comments)
                    .Must(items => items.Select(i => i.TrackingCommentId).Distinct().Count() == items.Count)
                    .WithMessage("Un comentario no se puede valorar dos veces en la misma sesión.");
                RuleForEach(c => c.Comments).ChildRules(item =>
                {
                    item.RuleFor(i => i.TrackingCommentId).NotEmpty();
                    item.RuleFor(i => i.Assessment)
                        .Must(a => ObservationAssessment.TryFromName(a, out _))
                        .WithMessage($"La valoración debe ser una de: {string.Join(", ", ObservationAssessment.List.Select(a => a.Name))}.");
                    item.RuleFor(i => i.Note).MaximumLength(CommentEvaluation.Rules.NoteMaxLength);
                });
            }
        }

        public record SubprincipioEvaluationDto(
            string? SubprincipioId,
            string MomentName,
            string PrincipleLabel,
            string SubprincipioLabel,
            string Assessment,
            string? Comment);

        public record CommentEvaluationDto(string? TrackingCommentId, string Title, string Assessment, string? Note);

        public record SessionEvaluationDto(
            string Id,
            string? TrainingSessionId,
            string SessionName,
            DateOnly SessionDate,
            IReadOnlyList<SubprincipioEvaluationDto> Subprincipios,
            DateTime CreatedAt,
            DateTime UpdatedAt,
            IReadOnlyList<CommentEvaluationDto> Comments);

        internal static SessionEvaluationDto ToDto(PlayerSessionEvaluation e) =>
            new(e.Id, e.TrainingSessionId, e.SessionName, e.SessionDate,
                e.Subprincipios
                    .Select(s => new SubprincipioEvaluationDto(
                        s.SubprincipioId, s.MomentName, s.PrincipleLabel, s.SubprincipioLabel, s.Assessment.Name, s.Comment))
                    .ToList(),
                e.CreatedAt, e.UpdatedAt,
                e.Comments
                    .Select(c => new CommentEvaluationDto(c.TrackingCommentId, c.Title, c.Assessment.Name, c.Note))
                    .ToList());

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, SessionEvaluationDto>
        {
            public async ValueTask<SessionEvaluationDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await PlayerTrackingGuards.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);

                var session = await db.TrainingSessions
                    .AsNoTracking()
                    .Where(s => s.Id == request.SessionId && s.TeamId == request.TeamId && s.Date != null)
                    .Select(s => new { s.Id, s.Name, Date = s.Date!.Value, TargetIds = s.Targets.Select(t => t.SubSubPrincipioId).ToList() })
                    .SingleOrDefaultAsync(cancellationToken)
                    ?? throw new NotFoundException($"TrainingSession '{request.SessionId}' Not Found", ErrorCodes.SessionNotFound);

                var inputs = await SubprincipioInputsAsync(request, session.TargetIds, cancellationToken);
                var commentInputs = await CommentInputsAsync(request, cancellationToken);
                var today = DateOnly.FromDateTime(DateTime.UtcNow);

                var existing = await db.PlayerSessionEvaluations
                    .Include(e => e.Subprincipios)
                    .Include(e => e.Comments)
                    .SingleOrDefaultAsync(e => e.TeamPlayerId == request.TeamPlayerId && e.TrainingSessionId == session.Id, cancellationToken);

                if (existing is null)
                {
                    existing = PlayerSessionEvaluation.Create(
                        request.TeamId, request.TeamPlayerId,
                        new SessionSnapshot(session.Id, session.Name, DateOnly.FromDateTime(session.Date)),
                        inputs, currentUser.UserId ?? throw new UnauthorizedAccessException(), today, commentInputs);
                    db.PlayerSessionEvaluations.Add(existing);
                }
                else
                {
                    existing.ReplaceEvaluations(inputs, today, commentInputs);
                }

                await db.SaveChangesAsync(cancellationToken);
                return ToDto(existing);
            }

            private async Task<List<SubprincipioEvaluationInput>> SubprincipioInputsAsync(
                Command request, List<string> targetIds, CancellationToken cancellationToken)
            {
                if (request.Evaluations.Count == 0)
                    return new List<SubprincipioEvaluationInput>();

                var trainedSubprincipioIds = await db.SubSubPrincipios
                    .AsNoTracking()
                    .Where(ssp => targetIds.Contains(ssp.Id))
                    .Select(ssp => ssp.SubprincipioId ?? (ssp.Zona != null ? ssp.Zona.SubprincipioId : null))
                    .Where(id => id != null)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                var requestedIds = request.Evaluations.Select(i => i.SubprincipioId).ToList();
                var notTrained = requestedIds.Except(trainedSubprincipioIds!).ToList();
                if (notTrained.Count > 0)
                    throw new DomainException("Seguimiento", "Solo se pueden valorar los subprincipios trabajados en la sesión.",
                        ErrorCodes.SubprincipioNotInSession);

                var snapshots = await db.Subprincipios
                    .AsNoTracking()
                    .Where(sp => requestedIds.Contains(sp.Id))
                    .Select(sp => new SubprincipioSnapshot(
                        sp.Id,
                        sp.GamePrinciple.GameMoment.Name,
                        sp.GamePrinciple.Numero + ". " + sp.GamePrinciple.Titulo,
                        sp.Numero + " " + sp.Titulo))
                    .ToDictionaryAsync(s => s.Id, cancellationToken);

                return request.Evaluations
                    .Select(i => new SubprincipioEvaluationInput(snapshots[i.SubprincipioId], ObservationAssessment.FromName(i.Assessment), i.Comment))
                    .ToList();
            }

            private async Task<List<CommentEvaluationInput>> CommentInputsAsync(Command request, CancellationToken cancellationToken)
            {
                if (request.Comments.Count == 0)
                    return new List<CommentEvaluationInput>();

                var ids = request.Comments.Select(c => c.TrackingCommentId).ToList();
                var titles = await db.TrackingComments
                    .AsNoTracking()
                    .Where(c => c.TeamId == request.TeamId && ids.Contains(c.Id))
                    .ToDictionaryAsync(c => c.Id, c => c.Title, cancellationToken);
                if (titles.Count != ids.Count)
                    throw new NotFoundException("Algún comentario no pertenece al catálogo del equipo.", ErrorCodes.TrackingCommentNotFound);

                return request.Comments
                    .Select(c => new CommentEvaluationInput(c.TrackingCommentId, titles[c.TrackingCommentId], ObservationAssessment.FromName(c.Assessment), c.Note))
                    .ToList();
            }
        }
    }
}
