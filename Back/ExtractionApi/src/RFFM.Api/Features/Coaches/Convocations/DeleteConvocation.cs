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
    public class DeleteConvocation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete(
                    "/api/events/{eventId}/convocations/{convocationId}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string eventId, string convocationId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(
                            new DeleteConvocationCommand { EventId = eventId, ConvocationId = convocationId },
                            cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteConvocation))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record DeleteConvocationCommand : IRequest<Unit>
        {
            public string EventId { get; init; } = null!;
            public string ConvocationId { get; init; } = null!;
        }

        public class Handler : IRequestHandler<DeleteConvocationCommand, Unit>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(
                DeleteConvocationCommand request,
                CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations
                    .FirstOrDefaultAsync(
                        c => c.Id == request.ConvocationId && c.SportEventId == request.EventId,
                        cancellationToken);

                if (conv == null)
                    throw new KeyNotFoundException($"Convocation {request.ConvocationId} not found for event {request.EventId}.");

                _db.Convocations.Remove(conv);
                await _db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
