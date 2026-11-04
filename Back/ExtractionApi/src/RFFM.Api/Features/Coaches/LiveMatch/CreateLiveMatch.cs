using System.Security.Claims;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public class CreateLiveMatch : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(
                    "/api/events/{eventId}/live-match",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new CreateLiveMatchCommand(eventId, userId), cancellationToken);
                        return result.Created
                            ? Results.Created($"/api/events/{eventId}/live-match", result.State)
                            : Results.Ok(result.State);
                    })
                .WithName(nameof(CreateLiveMatch))
                .WithTags("LiveMatch")
                .Produces<LiveMatchStateResponse>(StatusCodes.Status201Created)
                .Produces<LiveMatchStateResponse>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record CreateLiveMatchCommand(string EventId, string UserId) : RFFM.Api.Common.ICommand<CreateLiveMatchResult>;

        public record CreateLiveMatchResult(LiveMatchStateResponse State, bool Created);

        public class Validator : AbstractValidator<CreateLiveMatchCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.UserId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<CreateLiveMatchCommand, CreateLiveMatchResult>
        {
            private const int FallbackMatchDurationMinutes = 60;

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<CreateLiveMatchResult> Handle(CreateLiveMatchCommand request, CancellationToken cancellationToken = default)
            {
                var userIsTeamCoach = await LiveMatchTeamAccess.IsTeamCoachAsync(_db, request.UserId, request.EventId, cancellationToken);
                if (!userIsTeamCoach)
                    throw new ForbiddenAccessException("No tienes acceso a este partido en directo.");

                var existing = await FindStateAsync(request.EventId, cancellationToken);
                if (existing is not null)
                    return NotCreated(existing);

                var sportEvent = await _db.SportEvents
                    .AsNoTracking()
                    .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                if (sportEvent is null)
                    throw new NotFoundException("El evento no existe.", "EventNotFound");

                var matchDurationMinutes = sportEvent.MatchDurationMinutes
                    ?? await StandardMatchDurationAsync(sportEvent.TeamId, cancellationToken);
                var state = LiveMatchState.Create(request.EventId, sportEvent.TeamId, matchDurationMinutes, DateTime.UtcNow, request.UserId);
                _db.LiveMatchStates.Add(state);

                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    _db.Entry(state).State = EntityState.Detached;
                    var concurrentlyCreated = await FindStateAsync(request.EventId, cancellationToken);
                    if (concurrentlyCreated is null)
                        throw;

                    return NotCreated(concurrentlyCreated);
                }

                return new CreateLiveMatchResult(LiveMatchStateResponse.From(state, DateTime.UtcNow), true);
            }

            private Task<LiveMatchState?> FindStateAsync(string eventId, CancellationToken cancellationToken)
                => _db.LiveMatchStates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.EventId == eventId, cancellationToken);

            private async Task<int> StandardMatchDurationAsync(string teamId, CancellationToken cancellationToken)
            {
                var categoryId = await _db.Teams
                    .AsNoTracking()
                    .Where(t => t.Id == teamId)
                    .Select(t => t.CategoryId)
                    .FirstOrDefaultAsync(cancellationToken);

                var hasStandardHalfMinutes = MatchDurationMinutesByCategory.TryGetMinutes(categoryId, out var halfMinutes);
                return hasStandardHalfMinutes ? 2 * halfMinutes : FallbackMatchDurationMinutes;
            }

            private static CreateLiveMatchResult NotCreated(LiveMatchState state)
                => new(LiveMatchStateResponse.From(state, DateTime.UtcNow), false);
        }
    }
}
