using FluentValidation;
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
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    public class SendAvailabilityReminders : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/availability-requests/reminders",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, SendAvailabilityRemindersRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new SendAvailabilityRemindersCommand(eventId, request.TeamPlayerIds), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SendAvailabilityReminders))
                .WithTags("Availability")
                .Produces<SendAvailabilityRemindersResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record SendAvailabilityRemindersRequest(IReadOnlyCollection<string> TeamPlayerIds);

        public record SendAvailabilityRemindersCommand(string EventId, IReadOnlyCollection<string> TeamPlayerIds)
            : RFFM.Api.Common.ICommand<SendAvailabilityRemindersResponse>;

        public record SendAvailabilityRemindersResponse(int NotifiedCount);

        public class Validator : AbstractValidator<SendAvailabilityRemindersCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.TeamPlayerIds).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<SendAvailabilityRemindersCommand, SendAvailabilityRemindersResponse>
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

            public async ValueTask<SendAvailabilityRemindersResponse> Handle(SendAvailabilityRemindersCommand request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.Id == request.EventId)
                    .Select(se => new { se.Id, se.TeamId, se.Team.ClubId })
                    .FirstOrDefaultAsync(cancellationToken);
                if (sportEvent is null)
                    throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);

                await AvailabilityAuthorization.EnsureCanManageTeamAsync(_db, _currentUser, sportEvent.TeamId, sportEvent.ClubId, cancellationToken);

                var requestedStatusId = AvailabilityRequestStatus.Requested.Id;
                var pendingTeamPlayerIds = await _db.AvailabilityRequests
                    .AsNoTracking()
                    .Where(r => r.SportEventId == request.EventId
                        && r.StatusId == requestedStatusId
                        && request.TeamPlayerIds.Contains(r.TeamPlayerId)
                        && !_db.Convocations.Any(c => c.SportEventId == r.SportEventId && c.TeamPlayerId == r.TeamPlayerId))
                    .Select(r => r.TeamPlayerId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var teamPlayerId in pendingTeamPlayerIds)
                    await _dispatcher.DispatchAvailabilityRequestedAsync(teamPlayerId, request.EventId, cancellationToken);

                return new SendAvailabilityRemindersResponse(pendingTeamPlayerIds.Count);
            }
        }
    }
}
