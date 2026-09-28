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
using RFFM.Api.Features.Coaches.Teams;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class SendConvocationReminders : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/events/{eventId}/convocations/reminders",
                    [Authorize(Roles = "Coach,Administrator")] async (string eventId, SendConvocationRemindersRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new SendConvocationRemindersCommand(eventId, request.TeamPlayerIds), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(SendConvocationReminders))
                .WithTags("Convocations")
                .Produces<SendConvocationRemindersResponse>()
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record SendConvocationRemindersRequest(IReadOnlyCollection<string> TeamPlayerIds);

        public record SendConvocationRemindersCommand(string EventId, IReadOnlyCollection<string> TeamPlayerIds)
            : RFFM.Api.Common.ICommand<SendConvocationRemindersResponse>;

        public record SendConvocationRemindersResponse(int NotifiedCount);

        public class Validator : AbstractValidator<SendConvocationRemindersCommand>
        {
            public Validator()
            {
                RuleFor(x => x.EventId).NotEmpty();
                RuleFor(x => x.TeamPlayerIds).NotEmpty();
            }
        }

        public class Handler : IRequestHandler<SendConvocationRemindersCommand, SendConvocationRemindersResponse>
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

            public async ValueTask<SendConvocationRemindersResponse> Handle(SendConvocationRemindersCommand request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.Id == request.EventId)
                    .Select(se => new { se.Id, se.TeamId, se.Team.ClubId })
                    .FirstOrDefaultAsync(cancellationToken);
                if (sportEvent is null)
                    throw new NotFoundException("Evento no encontrado.", ErrorCodes.SportEventNotFound);

                var isAdministrator = (_currentUser.Roles ?? Enumerable.Empty<string>())
                    .Any(r => r.Equals("Administrator", StringComparison.OrdinalIgnoreCase));
                var canManageTeam = isAdministrator || await TeamEditAuthorization.CanEditAsync(
                    _db, _currentUser.UserId, sportEvent.TeamId, sportEvent.ClubId, cancellationToken);
                if (!canManageTeam)
                    throw new ForbiddenAccessException("No tienes permiso para notificar a los convocados de este equipo.");

                var pendingStatusId = ConvocationStatus.FromName("Pending").Id;
                var pendingTeamPlayerIds = await _db.Convocations
                    .AsNoTracking()
                    .Where(c => c.SportEventId == request.EventId
                        && c.ConvocationStatusId == pendingStatusId
                        && request.TeamPlayerIds.Contains(c.TeamPlayerId))
                    .Select(c => c.TeamPlayerId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var teamPlayerId in pendingTeamPlayerIds)
                {
                    await _dispatcher.DispatchConvocationReminderAsync(teamPlayerId, request.EventId, cancellationToken);
                }

                return new SendConvocationRemindersResponse(pendingTeamPlayerIds.Count);
            }
        }
    }
}
