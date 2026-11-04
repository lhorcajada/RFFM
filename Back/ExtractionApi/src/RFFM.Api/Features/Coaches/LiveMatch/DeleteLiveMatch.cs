using System.Security.Claims;
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

namespace RFFM.Api.Features.Coaches.LiveMatch
{
    public class DeleteLiveMatch : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete(
                    "/api/events/{eventId}/live-match",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(new DeleteLiveMatchCommand(eventId, userId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteLiveMatch))
                .WithTags("LiveMatch")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record DeleteLiveMatchCommand(string EventId, string UserId) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<DeleteLiveMatchCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.UserId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<DeleteLiveMatchCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ILiveMatchBroadcaster _broadcaster;

            public Handler(AppDbContext db, ILiveMatchBroadcaster broadcaster)
            {
                _db = db;
                _broadcaster = broadcaster;
            }

            public async ValueTask<Unit> Handle(DeleteLiveMatchCommand request, CancellationToken cancellationToken = default)
            {
                var userIsTeamCoach = await LiveMatchTeamAccess.IsTeamCoachAsync(_db, request.UserId, request.EventId, cancellationToken);
                if (!userIsTeamCoach)
                    throw new ForbiddenAccessException("No tienes acceso a este partido en directo.");

                try
                {
                    await RemoveEventRecordsAsync(request.EventId, cancellationToken);
                }
                catch (DbUpdateConcurrencyException)
                {
                    // A live action saved a newer version between the load and the delete. The delete is
                    // unconditional, so retry once from a clean change tracker instead of failing the request.
                    _db.ChangeTracker.Clear();
                    await RemoveEventRecordsAsync(request.EventId, cancellationToken);
                }

                await _broadcaster.BroadcastDeletedAsync(request.EventId, cancellationToken);
                return Unit.Value;
            }

            private async Task RemoveEventRecordsAsync(string eventId, CancellationToken cancellationToken)
            {
                var state = await _db.LiveMatchStates.FirstOrDefaultAsync(s => s.EventId == eventId, cancellationToken);
                if (state is not null)
                    _db.LiveMatchStates.Remove(state);

                var participations = await _db.MatchParticipations
                    .Where(mp => mp.EventId == eventId)
                    .ToListAsync(cancellationToken);
                _db.MatchParticipations.RemoveRange(participations);

                await _db.SaveChangesAsync(cancellationToken);
            }
        }
    }
}
