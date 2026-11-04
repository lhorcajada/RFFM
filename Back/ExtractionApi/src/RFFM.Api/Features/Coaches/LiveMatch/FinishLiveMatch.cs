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
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public class FinishLiveMatch : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(
                    "/api/events/{eventId}/live-match/finish",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, FinishLiveMatchRequest request, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new FinishLiveMatchCommand(eventId, userId, request), cancellationToken);
                        if (result.Conflict)
                        {
                            return Results.Problem(
                                statusCode: StatusCodes.Status409Conflict,
                                title: "Conflicto con el estado del partido",
                                extensions: new Dictionary<string, object?> { ["currentState"] = result.State });
                        }

                        return Results.Ok(result.State);
                    })
                .WithName(nameof(FinishLiveMatch))
                .WithTags("LiveMatch")
                .Produces<LiveMatchStateResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record FinishLiveMatchRequest(int BaseVersion, List<FinishPlayer> Players);

        public record FinishPlayer(string TeamPlayerId, int MinutesPlayed, bool IsStarter, int? EnteredAtMinute, int? ExitedAtMinute);

        public record FinishLiveMatchCommand(string EventId, string UserId, FinishLiveMatchRequest Request)
            : RFFM.Api.Common.ICommand<FinishLiveMatchResult>;

        public record FinishLiveMatchResult(LiveMatchStateResponse State, bool Conflict);

        public class Validator : AbstractValidator<FinishLiveMatchCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.UserId).NotEmpty();

                RuleFor(x => x.Request.BaseVersion)
                    .GreaterThanOrEqualTo(0)
                    .WithMessage("La versión base no puede ser negativa.");

                RuleFor(x => x.Request.Players)
                    .NotEmpty()
                    .WithMessage("Debes indicar al menos un jugador convocado al partido.");

                RuleForEach(x => x.Request.Players).SetValidator(new FinishPlayerValidator());
            }
        }

        public class FinishPlayerValidator : AbstractValidator<FinishPlayer>
        {
            private const int MaxTeamPlayerIdLength = 200;

            public FinishPlayerValidator()
            {
                RuleFor(p => p.TeamPlayerId)
                    .NotEmpty()
                    .MaximumLength(MaxTeamPlayerIdLength);

                RuleFor(p => p.MinutesPlayed)
                    .InclusiveBetween(0, SaveMatchParticipation.MaxMatchDurationMinutes);

                RuleFor(p => p.EnteredAtMinute)
                    .GreaterThanOrEqualTo(0)
                    .When(p => p.EnteredAtMinute is not null);

                RuleFor(p => p.ExitedAtMinute)
                    .GreaterThanOrEqualTo(0)
                    .When(p => p.ExitedAtMinute is not null);
            }
        }

        public class Handler : IRequestHandler<FinishLiveMatchCommand, FinishLiveMatchResult>
        {
            private const string LiveMatchNotFoundCode = "LiveMatchNotFound";
            private const string LiveMatchPhaseNotAllowedCode = "LiveMatchPhaseNotAllowed";
            private const string LiveMatchFinishRejectedCode = "LiveMatchFinishRejected";

            private readonly AppDbContext _db;
            private readonly ILiveMatchBroadcaster _broadcaster;

            public Handler(AppDbContext db, ILiveMatchBroadcaster broadcaster)
            {
                _db = db;
                _broadcaster = broadcaster;
            }

            public async ValueTask<FinishLiveMatchResult> Handle(FinishLiveMatchCommand request, CancellationToken cancellationToken = default)
            {
                var userIsTeamCoach = await LiveMatchTeamAccess.IsTeamCoachAsync(_db, request.UserId, request.EventId, cancellationToken);
                if (!userIsTeamCoach)
                    throw new ForbiddenAccessException("No tienes acceso a este partido en directo.");

                var result = await _db.Database.CreateExecutionStrategy()
                    .ExecuteAsync(ct => FinishInTransactionAsync(request, ct), cancellationToken);

                if (!result.Conflict)
                    await _broadcaster.BroadcastUpdatedAsync(request.EventId, result.State, cancellationToken);

                return result;
            }

            // Runs inside the execution strategy, so it may be re-invoked after a transient failure.
            // Every attempt starts from a cleared change tracker and reloads the state.
            private async Task<FinishLiveMatchResult> FinishInTransactionAsync(FinishLiveMatchCommand request, CancellationToken cancellationToken)
            {
                _db.ChangeTracker.Clear();

                var state = await _db.LiveMatchStates.FirstOrDefaultAsync(s => s.EventId == request.EventId, cancellationToken);
                if (state is null)
                    throw new NotFoundException("El partido en directo no existe.", LiveMatchNotFoundCode);

                var serverNow = DateTime.UtcNow;
                var baseVersionIsStale = state.Version != request.Request.BaseVersion;
                if (baseVersionIsStale || state.IsClosed)
                    return new FinishLiveMatchResult(LiveMatchStateResponse.From(state, serverNow), true);

                if (state.Phase != LiveMatchPhases.SecondHalf)
                {
                    throw new DomainException(
                        "Partido en directo",
                        "Solo se puede finalizar el partido durante la segunda parte.",
                        LiveMatchPhaseNotAllowedCode);
                }

                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    await new MatchParticipationWriter(_db).SaveAsync(BuildWriterRequest(state, request.Request), cancellationToken);

                    var closed = state.Close(serverNow, request.UserId);
                    if (!closed.IsSuccess)
                    {
                        throw new DomainException(
                            "Partido en directo",
                            closed.ErrorMessage ?? "No se puede finalizar el partido.",
                            closed.ErrorCode ?? LiveMatchFinishRejectedCode);
                    }

                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    return new FinishLiveMatchResult(LiveMatchStateResponse.From(state, serverNow), false);
                }
                catch (DbUpdateConcurrencyException)
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                    _db.ChangeTracker.Clear();
                    return await CurrentStateAsConflictAsync(request.EventId, CancellationToken.None);
                }
                catch
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                    throw;
                }
            }

            private async Task<FinishLiveMatchResult> CurrentStateAsConflictAsync(string eventId, CancellationToken cancellationToken)
            {
                var current = await _db.LiveMatchStates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.EventId == eventId, cancellationToken);
                if (current is null)
                    throw new NotFoundException("El partido en directo no existe.", LiveMatchNotFoundCode);

                return new FinishLiveMatchResult(LiveMatchStateResponse.From(current, DateTime.UtcNow), true);
            }

            private static SaveMatchParticipation.SaveMatchParticipationRequest BuildWriterRequest(LiveMatchState state, FinishLiveMatchRequest request)
                => new()
                {
                    EventId = state.EventId,
                    TeamId = state.TeamId,
                    ScoreLocal = state.ScoreLocal,
                    ScoreVisitor = state.ScoreVisitor,
                    MatchPhase = "finished",
                    Players = request.Players
                        .Select(p => new SaveMatchParticipation.PlayerParticipationDto(
                            p.TeamPlayerId, p.MinutesPlayed, p.IsStarter, p.EnteredAtMinute, p.ExitedAtMinute))
                        .ToList(),
                    SubstitutionWindowsJson = state.Documents.SubstitutionWindowsJson,
                    RatingSnapshotsJson = state.Documents.RatingSnapshotsJson,
                    GoalsJson = state.Documents.GoalsJson,
                    CardsJson = state.Documents.CardsJson,
                    FormationChangesJson = state.Documents.FormationChangesJson,
                    MatchDurationMinutes = state.MatchDurationMinutes,
                    StartingLineupJson = state.Documents.StartingLineupJson,
                };
        }
    }
}
