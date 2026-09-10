using FluentValidation;
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
    /// <summary>
    /// Sets or clears the free-text reason explaining why a convocated player is planned to
    /// play fewer minutes than other convocated players. Independent of AssistanceTypeId/
    /// ExcuseTypeId (those model absence, not reduced participation). Optional field: an
    /// empty/whitespace/null reason clears it.
    /// PUT /api/events/{eventId}/convocations/{convocationId}/minutes-reason
    /// </summary>
    public class UpdateConvocationMinutesReason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/{convocationId}/minutes-reason",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, string convocationId, UpdateConvocationMinutesReasonRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        request.ConvocationId = convocationId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationMinutesReason))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateConvocationMinutesReasonRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string ConvocationId { get; set; } = null!;
            public string? Reason { get; set; }
        }

        public class Validator : AbstractValidator<UpdateConvocationMinutesReasonRequest>
        {
            public Validator()
            {
                RuleFor(x => x.Reason).MaximumLength(500);
            }
        }

        public class Handler : IRequestHandler<UpdateConvocationMinutesReasonRequest, Unit>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<Unit> Handle(UpdateConvocationMinutesReasonRequest request, CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations
                    .FirstOrDefaultAsync(c => c.Id == request.ConvocationId && c.SportEventId == request.EventId, cancellationToken);
                if (conv == null) throw new ArgumentException("Convocation not found");

                conv.SetMinutesReason(request.Reason);

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
