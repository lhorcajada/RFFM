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
    public class UpdateConvocationAvailability : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/{convocationId}/availability",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, string convocationId, UpdateAvailabilityRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        request.ConvocationId = convocationId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationAvailability))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateAvailabilityRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string ConvocationId { get; set; } = null!;
            public int? AvailabilityTypeId { get; set; }
        }

        public class Handler : IRequestHandler<UpdateAvailabilityRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(UpdateAvailabilityRequest request, CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations
                    .FirstOrDefaultAsync(c => c.Id == request.ConvocationId && c.SportEventId == request.EventId, cancellationToken);

                if (conv == null) throw new ArgumentException("Convocation not found");

                if (request.AvailabilityTypeId.HasValue)
                {
                    var availabilityType = AvailabilityType.FromId(request.AvailabilityTypeId.Value)
                        ?? throw new ArgumentException($"Invalid availability type id: {request.AvailabilityTypeId}");
                }

                conv.SetAvailabilityTypeId(request.AvailabilityTypeId);
                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
