using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public class ApplyLiveMatchAction : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(
                    "/api/events/{eventId}/live-match/actions",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, ApplyLiveMatchActionRequest request, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new ApplyLiveMatchActionCommand(eventId, userId, request), cancellationToken);
                        if (result.Conflict)
                        {
                            return Results.Problem(
                                statusCode: StatusCodes.Status409Conflict,
                                title: "Conflicto con el estado del partido",
                                extensions: new Dictionary<string, object?> { ["currentState"] = result.State });
                        }

                        return Results.Ok(result.State);
                    })
                .WithName(nameof(ApplyLiveMatchAction))
                .WithTags("LiveMatch")
                .Produces<LiveMatchStateResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record ApplyLiveMatchActionRequest(string Type, int BaseVersion, ActionPayload? Payload);

        public record ActionPayload(int? DurationMinutes, int? DeltaSeconds, string? Formation, int? ScoreLocal, int? ScoreVisitor,
            LiveMatchDocuments? Documents);

        public record ApplyLiveMatchActionCommand(string EventId, string UserId, ApplyLiveMatchActionRequest Request)
            : RFFM.Api.Common.ICommand<ApplyLiveMatchActionResult>;

        public record ApplyLiveMatchActionResult(LiveMatchStateResponse State, bool Conflict);

        public class Validator : AbstractValidator<ApplyLiveMatchActionCommand>
        {
            private const int MaxMatchDurationMinutes = 200;
            private const int MaxClockAdjustmentSeconds = 7200;
            private const int MaxScore = 99;
            private const int MaxFormationLength = 50;

            private static readonly HashSet<string> ActionTypes = new()
            {
                LiveMatchActionTypes.SetLineup,
                LiveMatchActionTypes.SetDuration,
                LiveMatchActionTypes.KickOff,
                LiveMatchActionTypes.EndHalf,
                LiveMatchActionTypes.StartSecondHalf,
                LiveMatchActionTypes.AdjustClock,
                LiveMatchActionTypes.Goal,
                LiveMatchActionTypes.Card,
                LiveMatchActionTypes.Substitution,
                LiveMatchActionTypes.FormationChange,
            };

            private static readonly HashSet<string> ActionsRequiringPayload = new()
            {
                LiveMatchActionTypes.SetLineup,
                LiveMatchActionTypes.SetDuration,
                LiveMatchActionTypes.AdjustClock,
                LiveMatchActionTypes.Goal,
                LiveMatchActionTypes.Card,
                LiveMatchActionTypes.Substitution,
                LiveMatchActionTypes.FormationChange,
            };

            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.UserId).NotEmpty();

                RuleFor(x => x.Request.Type)
                    .Must(type => ActionTypes.Contains(type))
                    .WithMessage("El tipo de acción no es válido.");

                RuleFor(x => x.Request.BaseVersion)
                    .GreaterThanOrEqualTo(0)
                    .WithMessage("La versión base no puede ser negativa.");

                RuleFor(x => x.Request.Payload)
                    .NotNull()
                    .WithMessage("La acción requiere un payload.")
                    .When(x => ActionsRequiringPayload.Contains(x.Request.Type));

                RuleFor(x => x.Request)
                    .Must(request => request.Payload?.DurationMinutes is >= 1 and <= MaxMatchDurationMinutes)
                    .WithMessage($"La duración del partido debe estar entre 1 y {MaxMatchDurationMinutes} minutos.")
                    .When(x => x.Request.Type == LiveMatchActionTypes.SetDuration);

                RuleFor(x => x.Request)
                    .Must(request => request.Payload?.DeltaSeconds is >= -MaxClockAdjustmentSeconds and <= MaxClockAdjustmentSeconds)
                    .WithMessage($"El ajuste del reloj debe estar entre -{MaxClockAdjustmentSeconds} y {MaxClockAdjustmentSeconds} segundos.")
                    .When(x => x.Request.Type == LiveMatchActionTypes.AdjustClock);

                RuleFor(x => x.Request)
                    .Must(request => request.Payload?.ScoreLocal is >= 0 and <= MaxScore
                                     && request.Payload?.ScoreVisitor is >= 0 and <= MaxScore)
                    .WithMessage($"El marcador debe estar entre 0 y {MaxScore}.")
                    .When(x => x.Request.Type == LiveMatchActionTypes.Goal);

                RuleFor(x => x.Request)
                    .Must(request => request.Payload?.Formation is { Length: > 0 and <= MaxFormationLength })
                    .WithMessage($"La formación es obligatoria y no puede superar {MaxFormationLength} caracteres.")
                    .When(x => x.Request.Type == LiveMatchActionTypes.FormationChange);
            }
        }

        public class Handler : IRequestHandler<ApplyLiveMatchActionCommand, ApplyLiveMatchActionResult>
        {
            private const string LiveMatchNotFoundCode = "LiveMatchNotFound";
            private const string LiveMatchActionRejectedCode = "LiveMatchActionRejected";

            private readonly AppDbContext _db;
            private readonly ILiveMatchBroadcaster _broadcaster;

            public Handler(AppDbContext db, ILiveMatchBroadcaster broadcaster)
            {
                _db = db;
                _broadcaster = broadcaster;
            }

            public async ValueTask<ApplyLiveMatchActionResult> Handle(ApplyLiveMatchActionCommand request, CancellationToken cancellationToken = default)
            {
                var userIsTeamCoach = await LiveMatchTeamAccess.IsTeamCoachAsync(_db, request.UserId, request.EventId, cancellationToken);
                if (!userIsTeamCoach)
                    throw new ForbiddenAccessException("No tienes acceso a este partido en directo.");

                var state = await _db.LiveMatchStates.FirstOrDefaultAsync(s => s.EventId == request.EventId, cancellationToken);
                if (state is null)
                    throw new NotFoundException("El partido en directo no existe.", LiveMatchNotFoundCode);

                var baseVersionIsStale = state.Version != request.Request.BaseVersion;
                if (baseVersionIsStale || state.IsClosed)
                    return new ApplyLiveMatchActionResult(LiveMatchStateResponse.From(state, DateTime.UtcNow), true);

                var serverNow = DateTime.UtcNow;
                var applied = state.Apply(ToActionInput(request.Request), serverNow, request.UserId);
                if (!applied.IsSuccess)
                {
                    throw new DomainException(
                        "Partido en directo",
                        applied.ErrorMessage ?? "La acción no se puede aplicar.",
                        applied.ErrorCode ?? LiveMatchActionRejectedCode);
                }

                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateConcurrencyException)
                {
                    var winner = await _db.LiveMatchStates
                        .AsNoTracking()
                        .FirstOrDefaultAsync(s => s.EventId == request.EventId, cancellationToken);
                    if (winner is null)
                        throw new NotFoundException("El partido en directo no existe.", LiveMatchNotFoundCode);

                    return new ApplyLiveMatchActionResult(LiveMatchStateResponse.From(winner, DateTime.UtcNow), true);
                }

                var response = LiveMatchStateResponse.From(state, serverNow);
                await _broadcaster.BroadcastUpdatedAsync(request.EventId, response, cancellationToken);
                return new ApplyLiveMatchActionResult(response, false);
            }

            private static LiveMatchActionInput ToActionInput(ApplyLiveMatchActionRequest request)
            {
                var payload = request.Payload;
                return new LiveMatchActionInput(
                    request.Type,
                    payload?.DurationMinutes,
                    payload?.DeltaSeconds,
                    payload?.Formation,
                    payload?.ScoreLocal,
                    payload?.ScoreVisitor,
                    payload?.Documents);
            }
        }
    }
}
