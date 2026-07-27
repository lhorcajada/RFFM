using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class GetEventPlayers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/players",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var sportEvent = await db.SportEvents.AsNoTracking().FirstOrDefaultAsync(se => se.Id == eventId, cancellationToken);
                        if (sportEvent == null) throw new DomainException("Evento", "Evento no encontrado", "EventNotFound");
                        return await mediator.Send(new EventPlayersQuery { EventId = eventId, TeamId = sportEvent.TeamId }, cancellationToken);
                    })
                .WithName(nameof(GetEventPlayers))
                .WithTags("Convocations")
                .Produces<EventPlayerResponse[]>();
        }

        public record EventPlayersQuery : Common.IQueryApp<EventPlayerResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        // Added Dorsal (nullable int) to response
        public record EventPlayerResponse(string TeamPlayerId, string Alias, string? UrlPhoto, int? Dorsal, string? Position, string Status, bool IsInjured, string? PlayerId);

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
                var eventDate = sportEvent.EveDateTime.Date;

                // get team players not yet convocated for this event
                var convocatedIds = await _db.Convocations
                    .Where(c => c.SportEventId == request.EventId)
                    .Select(c => c.TeamPlayerId)
                    .ToListAsync(cancellationToken);

                var players = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Include(tp => tp.Injuries)
                    .Where(tp => tp.TeamId == teamId && !convocatedIds.Contains(tp.Id))
                    .Select(tp => new
                    {
                        Id = tp.Id,
                        PlayerId = tp.Player.Id,
                        Alias = tp.Player.Alias,
                        UrlPhoto = tp.Player.UrlPhoto,
                        DorsalNumber = tp.Dorsal != null ? (int?)tp.Dorsal.Number : null,
                        ActivePositionId = tp.Demarcation != null ? tp.Demarcation.ActivePositionId : (int?)null,
                        IsInjured = tp.Injuries.Any(i =>
                            i.StartDate.Date < eventDate &&
                            (i.EndDate == null || i.EndDate.Value.Date >= eventDate))
                    })
                    .ToArrayAsync(cancellationToken);

                // resolve demarcation names in memory
                var result = players.Select(tp => new EventPlayerResponse(
                    tp.Id,
                    tp.Alias,
                    tp.UrlPhoto,
                    tp.DorsalNumber,
                    tp.ActivePositionId != null ? RFFM.Api.Domain.Entities.Demarcations.DemarcationMaster.GetById(tp.ActivePositionId.Value)?.Name : null,
                    "Pendiente",
                    tp.IsInjured,
                    tp.PlayerId
                ))
                .ToArray();

                return result;
            }
        }
    }
}
