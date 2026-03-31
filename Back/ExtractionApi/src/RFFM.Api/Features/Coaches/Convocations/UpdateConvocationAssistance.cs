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
    public class UpdateConvocationAssistance : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/{convocationId}/assistance",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, string convocationId, UpdateAssistanceRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        request.ConvocationId = convocationId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationAssistance))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateAssistanceRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string ConvocationId { get; set; } = null!;
            public int? AssistanceTypeId { get; set; }
            public int? ExcuseTypeId { get; set; }
        }

        public class Handler : IRequestHandler<UpdateAssistanceRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(UpdateAssistanceRequest request, CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations
                    .FirstOrDefaultAsync(c => c.Id == request.ConvocationId && c.SportEventId == request.EventId, cancellationToken);

                if (conv == null) throw new ArgumentException("Convocation not found");

                if (request.AssistanceTypeId == null)
                {
                    conv.SetAssistanceTypeId(null);
                    conv.SetExcuseTypeId(null);
                    await _db.SaveChangesAsync(cancellationToken);
                    return Unit.Value;
                }

                // Validate assistance type (only the 4 real types, not Disponible/No disponible)
                var assistanceType = AssistanceType.From(request.AssistanceTypeId.Value);

                conv.SetAssistanceTypeId(request.AssistanceTypeId.Value);

                // ExcuseTypeId only applies when "No asiste con excusa" (id=2)
                if (assistanceType.Id == 2)
                {
                    if (request.ExcuseTypeId.HasValue)
                    {
                        var excuse = ExcuseTypes.FromId(request.ExcuseTypeId.Value)
                            ?? throw new ArgumentException($"Invalid excuse type id: {request.ExcuseTypeId}");
                    }
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
