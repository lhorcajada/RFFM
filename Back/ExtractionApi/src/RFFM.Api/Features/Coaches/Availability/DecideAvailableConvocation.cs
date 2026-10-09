using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    public class DecideAvailableConvocation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/availability-requests/{requestId}/decision",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, string requestId, DecideAvailableConvocationBody body, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new DecideAvailableConvocationCommand(eventId, requestId, body.Convoke), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DecideAvailableConvocation))
                .WithTags("Availability")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status409Conflict);
        }

        public record DecideAvailableConvocationBody(bool Convoke);

        public record DecideAvailableConvocationCommand(string EventId, string RequestId, bool Convoke) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<DecideAvailableConvocationCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.RequestId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<DecideAvailableConvocationCommand>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly ISanctionConvocationEnforcementService _enforcementService;

            public Handler(AppDbContext db, ICurrentUserService currentUser, ISanctionConvocationEnforcementService enforcementService)
            {
                _db = db;
                _currentUser = currentUser;
                _enforcementService = enforcementService;
            }

            public async ValueTask<Unit> Handle(DecideAvailableConvocationCommand request, CancellationToken cancellationToken = default)
            {
                var availability = await AvailabilityAuthorization.GetRequestAsync(_db, request.EventId, request.RequestId, cancellationToken);

                await AvailabilityAuthorization.EnsureCanManageEventTeamAsync(_db, _currentUser, availability.SportEvent.TeamId, cancellationToken);

                await AvailabilityAuthorization.EnsureNotDecidedAsync(_db, availability, cancellationToken);

                if (!availability.IsAvailable)
                    throw new ConflictException("El jugador no ha confirmado que esté disponible.", ErrorCodes.AvailabilityNotAvailable);

                if (request.Convoke)
                {
                    _db.Convocations.Add(Convocation.Create(new ConvocationModel
                    {
                        EventId = availability.SportEventId,
                        TeamPlayerId = availability.TeamPlayerId,
                        ConvocationStatusId = ConvocationStatus.FromName("Accepted").Id,
                        ResponseDateTime = DateTime.UtcNow
                    }));
                }
                else
                {
                    await _enforcementService.ForceDeconvocationAsync(
                        availability.TeamPlayerId, availability.SportEventId, ExcuseTypes.TechnicalDecision.Id, cancellationToken);
                }

                // The player already confirmed availability, so the convocation is not pushed.
                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException ex) when (ex.IsUniqueViolation())
                {
                    throw new ConflictException("La convocatoria de este jugador ya está decidida.", ErrorCodes.AvailabilityAlreadyDecided);
                }

                return Unit.Value;
            }
        }
    }
}
