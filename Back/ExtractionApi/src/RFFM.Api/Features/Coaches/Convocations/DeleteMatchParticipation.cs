using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// Deletes all MatchParticipation records for a given event + team combination.
    /// This effectively undoes a saved live match, allowing coaches to redo it.
    /// </summary>
    public class DeleteMatchParticipation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete(
                    "/api/events/{eventId}/match-participation",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(
                            new DeleteMatchParticipationCommand { EventId = eventId, TeamId = teamId },
                            cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteMatchParticipation))
                .WithTags("MatchParticipation")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record DeleteMatchParticipationCommand : IRequest<Unit>
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; init; } = null!;
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<DeleteMatchParticipationCommand, Unit>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(
                DeleteMatchParticipationCommand request,
                CancellationToken cancellationToken = default)
            {
                var records = await _db.MatchParticipations
                    .Where(mp => mp.EventId == request.EventId && mp.TeamId == request.TeamId)
                    .ToListAsync(cancellationToken);

                if (records.Count > 0)
                {
                    _db.MatchParticipations.RemoveRange(records);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                return Unit.Value;
            }
        }
    }
}
