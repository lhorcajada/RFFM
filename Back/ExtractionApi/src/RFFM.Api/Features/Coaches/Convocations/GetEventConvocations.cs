using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class GetEventConvocations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/convocations",
                    async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new EventConvocationsQuery { EventId = eventId }, cancellationToken);
                    })
                .WithName(nameof(GetEventConvocations))
                .WithTags("Convocations")
                .Produces<ConvocationResponse[]>();
        }

        public record EventConvocationsQuery : Common.IQueryApp<ConvocationResponse[]>
        {
            public string EventId { get; init; } = null!;
        }

        public record ConvocationResponse(string ConvocationId, string TeamPlayerId, string Alias, string? UrlPhoto, string? Position, string Status, int? StatusId, int? ExcuseTypeId, int? AvailabilityTypeId, int? AssistanceTypeId, bool IsInjured);

        public class Handler : IRequestHandler<EventConvocationsQuery, ConvocationResponse[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<ConvocationResponse[]> Handle(EventConvocationsQuery request, CancellationToken cancellationToken = default)
            {
                var convocationsRaw = await _db.Convocations
                    .AsNoTracking()
                    .Include(c => c.Player)
                        .ThenInclude(tp => tp.Player)
                    .Include(c => c.Player)
                        .ThenInclude(tp => tp.Injuries)
                    .Include(c => c.Status)
                    .Where(c => c.SportEventId == request.EventId)
                    .Select(c => new
                    {
                        Id = c.Id,
                        TeamPlayerId = c.TeamPlayerId,
                        Alias = c.Player.Player.Alias,
                        UrlPhoto = c.Player.Player.UrlPhoto,
                        ActivePositionId = c.Player.Demarcation != null ? (int?)c.Player.Demarcation.ActivePositionId : null,
                        StatusName = c.Status != null ? c.Status.Name : null,
                        StatusId = c.ConvocationStatusId,
                        ExcuseTypeId = c.ExcuseTypeId,
                        AvailabilityTypeId = c.AvailabilityTypeId,
                        AssistanceTypeId = c.AssistanceTypeId,
                        Injuries = c.Player.Injuries.Select(i => new { i.StartDate, i.EndDate }).ToList()
                    })
                    .ToArrayAsync(cancellationToken);

                var sportEvent = await _db.SportEvents.AsNoTracking()
                    .FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                var eventDate = sportEvent?.EveDateTime.Date ?? DateTime.UtcNow.Date;

                var result = convocationsRaw.Select(c => new ConvocationResponse(
                    c.Id,
                    c.TeamPlayerId,
                    c.Alias,
                    c.UrlPhoto,
                    c.ActivePositionId != null ? RFFM.Api.Domain.Entities.Demarcations.DemarcationMaster.GetById(c.ActivePositionId.Value)?.Name : null,
                    c.StatusName ?? "Pendiente",
                    c.StatusId,
                    c.ExcuseTypeId,
                    c.AvailabilityTypeId,
                    c.AssistanceTypeId,
                    c.Injuries.Any(i =>
                        i.StartDate.Date <= eventDate &&
                        (i.EndDate == null || i.EndDate.Value.Date >= eventDate))
                ))
                .ToArray();

                return result;
            }
        }
    }
}
