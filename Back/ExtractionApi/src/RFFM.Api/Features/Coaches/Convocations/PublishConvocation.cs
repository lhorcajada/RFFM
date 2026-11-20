using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Availability;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// The coach marks a league-match convocation as finished: from then on players and families
    /// see it and the called-up players are notified (before that it is a coach-only draft).
    /// </summary>
    public class PublishConvocation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/convocations/publish",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new PublishConvocationCommand(eventId), cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(PublishConvocation))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status409Conflict);
        }

        public record PublishConvocationCommand(string EventId) : RFFM.Api.Common.ICommand;

        public class Validator : FluentValidation.AbstractValidator<PublishConvocationCommand>
        {
            public Validator() => RuleFor(x => x.EventId).NotEmpty();
        }

        public class Handler : IRequestHandler<PublishConvocationCommand, Unit>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly IWebPushNotificationDispatcher _dispatcher;

            public Handler(AppDbContext db, ICurrentUserService currentUser, IWebPushNotificationDispatcher dispatcher)
            {
                _db = db;
                _currentUser = currentUser;
                _dispatcher = dispatcher;
            }

            public async ValueTask<Unit> Handle(PublishConvocationCommand request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents.FirstOrDefaultAsync(se => se.Id == request.EventId, cancellationToken)
                    ?? throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);

                await AvailabilityAuthorization.EnsureCanManageEventTeamAsync(_db, _currentUser, sportEvent.TeamId, cancellationToken);

                if (!ConvocationVisibility.IsLeagueMatch(sportEvent))
                    throw new ConflictException("Solo las convocatorias de partidos de liga se publican.", ErrorCodes.ConvocationNotPublishable);

                if (sportEvent.IsConvocationPublished)
                    return Unit.Value;

                sportEvent.PublishConvocation();
                await _db.SaveChangesAsync(cancellationToken);

                var deconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
                var calledTeamPlayerIds = await _db.Convocations.AsNoTracking()
                    .Where(c => c.SportEventId == request.EventId && c.ConvocationStatusId != deconvokeStatusId)
                    .Select(c => c.TeamPlayerId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var teamPlayerId in calledTeamPlayerIds)
                    await _dispatcher.DispatchConvocationCreatedAsync(teamPlayerId, request.EventId, cancellationToken);

                return Unit.Value;
            }
        }
    }
}
