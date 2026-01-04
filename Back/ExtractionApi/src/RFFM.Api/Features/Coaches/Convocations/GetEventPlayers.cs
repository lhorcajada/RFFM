using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class GetEventPlayers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/players",
                    async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new EventPlayersQuery { EventId = eventId }, cancellationToken);
                    })
                .WithName(nameof(GetEventPlayers))
                .WithTags("Convocations")
                .Produces<EventPlayerResponse[]>();
        }

        public record EventPlayersQuery : Common.IQueryApp<EventPlayerResponse[]>
        {
            public string EventId { get; init; } = null!;
        }

        // Added Dorsal (nullable int) to response
        public record EventPlayerResponse(string TeamPlayerId, string Alias, string? UrlPhoto, int? Dorsal, string? Position, string Status);

        public class Handler : IRequestHandler<EventPlayersQuery, EventPlayerResponse[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<EventPlayerResponse[]> Handle(EventPlayersQuery request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents
                    .AsNoTracking()
                    .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);

                if (sportEvent == null) return Array.Empty<EventPlayerResponse>();

                var teamId = sportEvent.TeamId;

                // get team players not yet convocated for this event
                var convocatedIds = await _db.Convocations
                    .Where(c => c.SportEventId == request.EventId)
                    .Select(c => c.TeamPlayerId)
                    .ToListAsync(cancellationToken);

                var players = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == teamId && !convocatedIds.Contains(tp.Id))
                    .Select(tp => new
                    {
                        Id = tp.Id,
                        Alias = tp.Player.Alias,
                        UrlPhoto = tp.Player.UrlPhoto,
                        DorsalNumber = tp.Dorsal != null ? (int?)tp.Dorsal.Number : null,
                        ActivePositionId = tp.Demarcation != null ? tp.Demarcation.ActivePositionId : (int?)null
                    })
                    .ToArrayAsync(cancellationToken);

                // resolve demarcation names in memory
                var result = players.Select(tp => new EventPlayerResponse(
                    tp.Id,
                    tp.Alias,
                    tp.UrlPhoto,
                    tp.DorsalNumber,
                    tp.ActivePositionId != null ? RFFM.Api.Domain.Entities.Demarcations.DemarcationMaster.GetById(tp.ActivePositionId.Value)?.Name : null,
                    "Pendiente"
                ))
                .ToArray();

                return result;
            }
        }
    }
}
