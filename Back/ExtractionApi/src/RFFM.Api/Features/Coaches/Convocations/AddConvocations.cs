using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class AddConvocations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/convocations",
                    [Authorize(Roles = "Coach")] async (string eventId, AddConvocationRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Created($"/api/events/{eventId}/convocations", null);
                    })
                .WithName(nameof(AddConvocations))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);

            app.MapPost("/api/events/{eventId}/convocations/bulk",
                    [Authorize(Roles = "Coach")] async (string eventId, BulkAddConvocationsRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Created($"/api/events/{eventId}/convocations", null);
                    })
                .WithName("AddBulkConvocations")
                .WithTags("Convocations")
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record AddConvocationRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string TeamPlayerId { get; set; } = null!;
            public int AssistanceTypeId { get; set; }
        }

        public record BulkAddConvocationsRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
        }

        public class AddConvocationHandler : IRequestHandler<AddConvocationRequest, Unit>
        {
            private readonly AppDbContext _db;
            public AddConvocationHandler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(AddConvocationRequest request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents.FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                if (sportEvent == null) throw new ArgumentException("Event not found");

                // Check start time
                if (sportEvent.StartTime <= DateTime.UtcNow) throw new InvalidOperationException("Event already started");

                // Check not already convocated
                var exists = await _db.Convocations.AnyAsync(c => c.SportEventId == request.EventId && c.TeamPlayerId == request.TeamPlayerId, cancellationToken);
                if (exists) throw new ArgumentException("Player already convocated");

                var model = new ConvocationModel
                {
                    EventId = request.EventId,
                    TeamPlayerId = request.TeamPlayerId,
                    AssistanceTypeId = request.AssistanceTypeId,
                    ConvocationStatusId = 1 // Pending
                };

                var conv = Convocation.Create(model);
                _db.Convocations.Add(conv);
                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }

        public class BulkAddConvocationHandler : IRequestHandler<BulkAddConvocationsRequest, Unit>
        {
            private readonly AppDbContext _db;
            public BulkAddConvocationHandler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(BulkAddConvocationsRequest request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents.FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken);
                if (sportEvent == null) throw new ArgumentException("Event not found");

                if (sportEvent.StartTime <= DateTime.UtcNow) throw new InvalidOperationException("Event already started");

                var teamPlayers = await _db.TeamPlayers.Where(tp => tp.TeamId == sportEvent.TeamId).ToListAsync(cancellationToken);

                var existing = await _db.Convocations.Where(c => c.SportEventId == request.EventId).Select(c => c.TeamPlayerId).ToListAsync(cancellationToken);

                foreach (var tp in teamPlayers.Where(tp => !existing.Contains(tp.Id)))
                {
                    var model = new ConvocationModel
                    {
                        EventId = request.EventId,
                        TeamPlayerId = tp.Id,
                        AssistanceTypeId = 1,
                        ConvocationStatusId = 1
                    };

                    _db.Convocations.Add(Convocation.Create(model));
                }

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
