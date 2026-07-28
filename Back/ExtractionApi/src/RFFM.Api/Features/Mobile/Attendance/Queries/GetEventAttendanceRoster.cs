using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Attendance.Queries
{
    public class GetEventAttendanceRoster : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/mobile/events/{eventId}/attendance-roster",
                    async (string eventId, AppDbContext db, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var sportEvent = await db.SportEvents.AsNoTracking()
                            .FirstOrDefaultAsync(se => se.Id == eventId, cancellationToken);
                        if (sportEvent == null) throw new DomainException("Evento", "Evento no encontrado", "EventNotFound");

                        var query = new EventAttendanceRosterQuery
                        {
                            EventId = eventId,
                            TeamId = sportEvent.TeamId
                        };
                        var result = await mediator.Send(query, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetEventAttendanceRoster))
                .WithTags("Attendance")
                .Produces<EventAttendanceRosterResponse[]>();
        }

        public record EventAttendanceRosterQuery : IQueryApp<EventAttendanceRosterResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; set; } = null!;
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.AttendanceConfirmation;
            public string RequiredPermission => "Read";
        }

        public record EventAttendanceRosterResponse(
            string TeamPlayerId,
            string? Alias,
            string? UrlPhoto,
            int? Dorsal,
            string Status,
            int StatusId);

        public class Handler(AppDbContext db) : IRequestHandler<EventAttendanceRosterQuery, EventAttendanceRosterResponse[]>
        {
            public async ValueTask<EventAttendanceRosterResponse[]> Handle(EventAttendanceRosterQuery request, CancellationToken cancellationToken)
            {
                var teamPlayers = await db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .OrderBy(tp => tp.Player.Name)
                    .ThenBy(tp => tp.Player.LastName)
                    .ToListAsync(cancellationToken);

                var confirmations = await db.Set<EventAttendanceConfirmation>()
                    .AsNoTracking()
                    .Where(eac => eac.SportEventId == request.EventId)
                    .ToListAsync(cancellationToken);

                var confirmationsByTeamPlayerId = confirmations.ToDictionary(c => c.TeamPlayerId);

                var result = teamPlayers.Select(tp =>
                {
                    var statusId = confirmationsByTeamPlayerId.TryGetValue(tp.Id, out var confirmation)
                        ? confirmation.AttendanceStatusId
                        : AttendanceStatus.Pending.Id;
                    var status = AttendanceStatus.FromId(statusId);

                    return new EventAttendanceRosterResponse(
                        tp.Id,
                        tp.Player.Alias,
                        tp.Player.UrlPhoto,
                        tp.Dorsal != null ? tp.Dorsal.Number : (int?)null,
                        status.Name,
                        status.Id);
                }).ToArray();

                return result;
            }
        }
    }
}
