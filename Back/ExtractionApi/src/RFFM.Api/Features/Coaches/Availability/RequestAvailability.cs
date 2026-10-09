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
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Availability
{
    public class RequestAvailability : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/availability-requests",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RequestAvailabilityCommand(eventId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(RequestAvailability))
                .WithTags("Availability")
                .Produces<RequestAvailabilityResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record RequestAvailabilityCommand(string EventId) : RFFM.Api.Common.ICommand<RequestAvailabilityResponse>;

        public record RequestAvailabilityResponse(int RequestedCount);

        public class Validator : AbstractValidator<RequestAvailabilityCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<RequestAvailabilityCommand, RequestAvailabilityResponse>
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

            public async ValueTask<RequestAvailabilityResponse> Handle(RequestAvailabilityCommand request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.Id == request.EventId)
                    .Select(se => new { se.Id, se.TeamId, se.Team.ClubId, se.EventTypeId, se.EveDateTime })
                    .FirstOrDefaultAsync(cancellationToken);
                if (sportEvent is null)
                    throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);

                await AvailabilityAuthorization.EnsureCanManageTeamAsync(_db, _currentUser, sportEvent.TeamId, sportEvent.ClubId, cancellationToken);

                if (sportEvent.EventTypeId != SportEventsConstants.MatchEventTypeId)
                    throw new DomainException("Disponibilidad", "Solo se puede pedir disponibilidad en partidos de liga.", ErrorCodes.AvailabilityOnlyForLeagueMatches);

                var eventDate = (sportEvent.EveDateTime ?? DateTime.UtcNow).Date;

                var convokedIds = await _db.Convocations
                    .Where(c => c.SportEventId == request.EventId)
                    .Select(c => c.TeamPlayerId)
                    .ToListAsync(cancellationToken);

                // Same "injured for this event" rule as GetEventPlayers: injury started before the event day.
                var candidateIds = await _db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == sportEvent.TeamId && !convokedIds.Contains(tp.Id))
                    .Where(tp => !tp.Injuries.Any(i => i.StartDate.Date < eventDate && (i.EndDate == null || i.EndDate.Value.Date >= eventDate)))
                    .Select(tp => tp.Id)
                    .ToListAsync(cancellationToken);

                // Same "blocked by an active automatic sanction" rule as BulkAddConvocationHandler.
                var sanctionStarts = await _db.TeamPlayerSanctions
                    .AsNoTracking()
                    .Where(s => s.IsAutomatic && s.EndDate == null && candidateIds.Contains(s.TeamPlayerId))
                    .GroupBy(s => s.TeamPlayerId)
                    .Select(g => new { TeamPlayerId = g.Key, StartDate = g.Max(s => s.StartDate) })
                    .ToListAsync(cancellationToken);
                var blockedIds = sanctionStarts
                    .Where(s => sportEvent.EveDateTime > s.StartDate)
                    .Select(s => s.TeamPlayerId)
                    .ToHashSet();

                var existingRequests = await _db.AvailabilityRequests
                    .Where(r => r.SportEventId == request.EventId)
                    .ToDictionaryAsync(r => r.TeamPlayerId, cancellationToken);

                var now = DateTime.UtcNow;
                var notifiedIds = new List<string>();
                foreach (var teamPlayerId in candidateIds.Where(id => !blockedIds.Contains(id)))
                {
                    if (!existingRequests.TryGetValue(teamPlayerId, out var existing))
                    {
                        _db.AvailabilityRequests.Add(AvailabilityRequest.Create(request.EventId, teamPlayerId, now));
                        notifiedIds.Add(teamPlayerId);
                        continue;
                    }

                    if (existing.IsUnavailable)
                    {
                        existing.Reopen(now);
                        notifiedIds.Add(teamPlayerId);
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);

                foreach (var teamPlayerId in notifiedIds)
                    await _dispatcher.DispatchAvailabilityRequestedAsync(teamPlayerId, request.EventId, cancellationToken);

                return new RequestAvailabilityResponse(notifiedIds.Count);
            }
        }
    }
}
