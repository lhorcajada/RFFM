using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class UpdateConvocationsAssistanceBulk : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/assistance",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, BulkAssistanceRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationsAssistanceBulk))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record BulkAssistanceRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public List<string> ConvocationIds { get; set; } = new();
            public int AssistanceTypeId { get; set; }
        }

        public class Handler : IRequestHandler<BulkAssistanceRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(BulkAssistanceRequest request, CancellationToken cancellationToken = default)
            {
                var assistanceType = AssistanceType.From(request.AssistanceTypeId);

                var ids = request.ConvocationIds.Distinct().ToList();
                if (ids.Count == 0) return Unit.Value;

                var convocations = await _db.Convocations
                    .Where(c => c.SportEventId == request.EventId && ids.Contains(c.Id))
                    .ToListAsync(cancellationToken);

                if (convocations.Count != ids.Count)
                    throw new ArgumentException("Convocation not found");

                foreach (var convocation in convocations)
                {
                    convocation.SetAssistanceTypeId(assistanceType.Id);
                    convocation.SetExcuseTypeId(null);
                }

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
