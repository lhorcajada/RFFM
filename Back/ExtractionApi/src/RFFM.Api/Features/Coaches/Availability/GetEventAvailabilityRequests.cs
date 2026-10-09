using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    public class GetEventAvailabilityRequests : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/availability-requests",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var teamId = await db.SportEvents.AsNoTracking()
                            .Where(se => se.Id == eventId)
                            .Select(se => se.TeamId)
                            .FirstOrDefaultAsync(cancellationToken);
                        if (teamId is null)
                            throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);
                        return await mediator.Send(new EventAvailabilityRequestsQuery { EventId = eventId, TeamId = teamId }, cancellationToken);
                    })
                .RequireAuthorization()
                .WithName(nameof(GetEventAvailabilityRequests))
                .WithTags("Availability")
                .Produces<AvailabilityRequestResponse[]>()
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record EventAvailabilityRequestsQuery : IQueryApp<AvailabilityRequestResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record AvailabilityRequestResponse(string Id, string TeamPlayerId, string Status, DateTime RequestedAt, DateTime? RespondedAt);

        public class Handler : IRequestHandler<EventAvailabilityRequestsQuery, AvailabilityRequestResponse[]>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<AvailabilityRequestResponse[]> Handle(EventAvailabilityRequestsQuery request, CancellationToken cancellationToken = default)
            {
                var rows = await _db.AvailabilityRequests
                    .AsNoTracking()
                    .Where(r => r.SportEventId == request.EventId)
                    .Select(r => new { r.Id, r.TeamPlayerId, r.StatusId, r.RequestedAt, r.RespondedAt })
                    .ToListAsync(cancellationToken);

                return rows
                    .Select(r => new AvailabilityRequestResponse(
                        r.Id, r.TeamPlayerId, AvailabilityRequestStatus.From(r.StatusId).Name, r.RequestedAt, r.RespondedAt))
                    .ToArray();
            }
        }
    }
}
