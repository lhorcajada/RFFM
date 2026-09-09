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
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, AddConvocationRequest request, IMediator mediator, CancellationToken cancellationToken) =>
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
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var request = new BulkAddConvocationsRequest { EventId = eventId };
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

                // Check not already convocated
                var exists = await _db.Convocations.AnyAsync(c => c.SportEventId == request.EventId && c.TeamPlayerId == request.TeamPlayerId, cancellationToken);
                if (exists) throw new ArgumentException("Player already convocated");

                // Block convocation while the player has an active automatic sanction for a
                // match later than the one that triggered it (design.md Decisión 4).
                var activeSanction = await _db.TeamPlayerSanctions
                    .Where(s => s.TeamPlayerId == request.TeamPlayerId && s.IsAutomatic && s.EndDate == null)
                    .OrderByDescending(s => s.StartDate)
                    .FirstOrDefaultAsync(cancellationToken);

                if (activeSanction is not null && sportEvent.EveDateTime > activeSanction.StartDate)
                    throw new ArgumentException(
                        $"El jugador está sancionado ({activeSanction.SanctionType}) y no puede ser convocado " +
                        "hasta que el entrenador levante la sanción.");

                var model = new ConvocationModel
                {
                    EventId = request.EventId,
                    TeamPlayerId = request.TeamPlayerId,
                    AssistanceTypeId = null,
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

                var teamPlayers = await _db.TeamPlayers.Where(tp => tp.TeamId == sportEvent.TeamId).ToListAsync(cancellationToken);

                var existing = await _db.Convocations.Where(c => c.SportEventId == request.EventId).Select(c => c.TeamPlayerId).ToListAsync(cancellationToken);

                // Players with an active automatic sanction (still open, later than the match
                // that triggered it) are silently skipped from the bulk convocation, same as
                // already-convocated players (design.md Decisión 4).
                var activeSanctionsByPlayer = await _db.TeamPlayerSanctions
                    .Where(s => s.IsAutomatic && s.EndDate == null && teamPlayers.Select(tp => tp.Id).Contains(s.TeamPlayerId))
                    .OrderByDescending(s => s.StartDate)
                    .ToListAsync(cancellationToken);
                var latestActiveSanctionByPlayer = activeSanctionsByPlayer
                    .GroupBy(s => s.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.First());

                bool IsBlockedBySanction(string teamPlayerId) =>
                    latestActiveSanctionByPlayer.TryGetValue(teamPlayerId, out var sanction) &&
                    sportEvent.EveDateTime > sanction.StartDate;

                foreach (var tp in teamPlayers.Where(tp => !existing.Contains(tp.Id) && !IsBlockedBySanction(tp.Id)))
                {
                    var model = new ConvocationModel
                    {
                        EventId = request.EventId,
                        TeamPlayerId = tp.Id,
                        AssistanceTypeId = null,
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
