using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    public class RespondAvailabilityRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/availability-requests/{requestId}/response",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")] async (string eventId, string requestId, RespondAvailabilityRequestBody body, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new RespondAvailabilityCommand(eventId, requestId, body.Available, body.ExcuseTypeId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(RespondAvailabilityRequest))
                .WithTags("Availability")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status409Conflict);
        }

        public record RespondAvailabilityRequestBody(bool Available, int? ExcuseTypeId);

        public record RespondAvailabilityCommand(string EventId, string RequestId, bool Available, int? ExcuseTypeId) : RFFM.Api.Common.ICommand;

        public class Validator : AbstractValidator<RespondAvailabilityCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.RequestId).NotEmpty();
                RuleFor(x => x.ExcuseTypeId)
                    .NotNull()
                    .When(x => !x.Available)
                    .WithMessage("Indica el motivo por el que el jugador no está disponible.");
                RuleFor(x => x.ExcuseTypeId)
                    .Must(id => id is null || (ExcuseTypes.FromId(id.Value) is not null
                        && id != ExcuseTypes.TechnicalDecision.Id
                        && id != ExcuseTypes.SportiveSanction.Id))
                    .When(x => !x.Available)
                    .WithMessage("El motivo indicado no es válido.");
            }
        }

        public class Handler : IRequestHandler<RespondAvailabilityCommand>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly ISanctionConvocationEnforcementService _enforcementService;
            private readonly IWebPushNotificationDispatcher _dispatcher;

            public Handler(AppDbContext db, ICurrentUserService currentUser,
                ISanctionConvocationEnforcementService enforcementService, IWebPushNotificationDispatcher dispatcher)
            {
                _db = db;
                _currentUser = currentUser;
                _enforcementService = enforcementService;
                _dispatcher = dispatcher;
            }

            public async ValueTask<Mediator.Unit> Handle(RespondAvailabilityCommand request, CancellationToken cancellationToken = default)
            {
                var availability = await AvailabilityAuthorization.GetRequestAsync(_db, request.EventId, request.RequestId, cancellationToken);

                var respondedByPlayerOrFamily = AvailabilityAuthorization.IsPlayerOrFamily(_currentUser);
                if (respondedByPlayerOrFamily)
                    await AvailabilityAuthorization.EnsureOwnPlayerAsync(_db, _currentUser, availability.TeamPlayerId, cancellationToken);
                else
                    await AvailabilityAuthorization.EnsureCanManageEventTeamAsync(_db, _currentUser, availability.SportEvent.TeamId, cancellationToken);

                await AvailabilityAuthorization.EnsureNotDecidedAsync(_db, availability, cancellationToken);

                var now = DateTime.UtcNow;
                if (request.Available)
                {
                    availability.MarkAvailable(now);
                }
                else
                {
                    availability.MarkUnavailable(now);
                    await _enforcementService.ForceDeconvocationAsync(
                        availability.TeamPlayerId, availability.SportEventId, request.ExcuseTypeId!.Value, cancellationToken);
                }

                await _db.SaveChangesAsync(cancellationToken);

                if (respondedByPlayerOrFamily)
                    await _dispatcher.DispatchAvailabilityRespondedAsync(availability.Id, cancellationToken);

                return Mediator.Unit.Value;
            }
        }
    }
}
