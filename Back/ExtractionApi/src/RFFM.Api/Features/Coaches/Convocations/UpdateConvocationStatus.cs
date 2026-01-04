using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class UpdateConvocationStatus : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/{convocationId}/status",
                    [Authorize(Roles = "Coach")] async (string eventId, string convocationId, UpdateStatusRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        request.ConvocationId = convocationId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationStatus))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateStatusRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string ConvocationId { get; set; } = null!;
            public int NewStatusId { get; set; }
            public int? ExcuseTypeId { get; set; }
        }

        public class Handler : IRequestHandler<UpdateStatusRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(UpdateStatusRequest request, CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations.Include(c => c.SportEvent).FirstOrDefaultAsync(c => c.Id == request.ConvocationId && c.SportEventId == request.EventId, cancellationToken);
                if (conv == null) throw new ArgumentException("Convocation not found");

                if (conv.SportEvent.StartTime <= DateTime.UtcNow) throw new InvalidOperationException("Event already started");

                // Validate status
                var status = ConvocationStatus.From(request.NewStatusId);
                conv.SetConvocationStatusId(request.NewStatusId);

                if (status.Name.Equals("Declined", StringComparison.OrdinalIgnoreCase))
                {
                    if (request.ExcuseTypeId == null) throw new ArgumentException("Excuse type required for Declined status");
                    var excuse = ExcuseTypes.FromId(request.ExcuseTypeId.Value) ?? throw new ArgumentException("Invalid excuse type");
                    conv.SetExcuseTypeId(request.ExcuseTypeId);
                }
                else
                {
                    conv.SetExcuseTypeId(null);
                }

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
