using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Queries
{
    public class GetEventAttendanceSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/sport-events/attendance-summary",
                    async (string teamId, string eventIds, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var ids = (eventIds ?? string.Empty)
                            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                        var query = new EventAttendanceSummaryQuery { TeamId = teamId, EventIds = ids };
                        var result = await mediator.Send(query, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetEventAttendanceSummary))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<EventAttendanceSummaryResponse[]>();
        }

        public record EventAttendanceSummaryQuery : IQueryApp<EventAttendanceSummaryResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;
            public string[] EventIds { get; set; } = Array.Empty<string>();

            public string FeatureRoute => CoachFeatureRoutes.Events;
            public string RequiredPermission => "Read";
        }

        /// <summary>
        /// Source of truth: <see cref="Convocation"/>.ConvocationStatusId — the same status the
        /// real convocation form (Front's ConvocationCard.tsx, backed by
        /// Features/Coaches/Convocations/UpdateConvocationStatus.cs) reads and writes. This is
        /// deliberately NOT EventAttendanceConfirmation/AttendanceStatus (Going/Pending/NotGoing),
        /// which belongs to the separate, unrelated Mobile RSVP flow
        /// (Features/Mobile/Attendance/Commands/ConfirmAttendance.cs) — that table is no longer
        /// read by this endpoint. Bucketing: Accepted → Going; Pending (or an unrecognized/null
        /// status id, defensively) → Pending; Deconvoke and Justified → NotGoing (a justified
        /// absence is still an absence for the purposes of this aggregate — see design.md
        /// Decision 3, revised). MyStatus/MyStatusId echo ConvocationStatus's own name/id
        /// ("Pending"/"Accepted"/"Deconvoke"/"Justified"), not a Going/NotGoing relabeling, so the
        /// frontend can act on the real convocation status. MyConvocationId is the caller's own
        /// Convocation.Id for this event (when convoked), needed to call
        /// PUT /api/events/{eventId}/convocations/{convocationId}/status directly from the
        /// dashboard widget. MyIsInjured is true while the caller's linked player has an active
        /// injury, so the widget hides the "Voy"/"No voy" actions until discharge.
        /// </summary>
        public record EventAttendanceSummaryResponse(
            string EventId, int Convocados, int Going, int Pending, int NotGoing,
            double AttendancePercentage, string? MyStatus, int? MyStatusId, string? MyConvocationId,
            bool MyIsInjured = false, string? MyAvailabilityRequestId = null, string? MyAvailabilityStatus = null);

        public class Validator : AbstractValidator<EventAttendanceSummaryQuery>
        {
            public Validator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.EventIds).NotEmpty();
                RuleFor(x => x.EventIds).Must(ids => ids.Length <= 50)
                    .WithMessage("No more than 50 event ids can be requested at once.");
            }
        }

        public class Handler : IRequestHandler<EventAttendanceSummaryQuery, EventAttendanceSummaryResponse[]>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private static readonly string[] RestrictedRoles = { "Player", "FamilyMember" };

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<EventAttendanceSummaryResponse[]> Handle(EventAttendanceSummaryQuery request, CancellationToken cancellationToken = default)
            {
                // 1. Authorized event ids: must exist AND belong to TeamId (design.md Decision 2).
                var authorizedEvents = await _db.SportEvents.AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && request.EventIds.Contains(se.Id))
                    .Select(se => new { se.Id, se.EveDateTime })
                    .ToListAsync(cancellationToken);

                if (authorizedEvents.Count == 0)
                    return Array.Empty<EventAttendanceSummaryResponse>();

                var authorizedEventIds = authorizedEvents.Select(e => e.Id).ToList();

                // 2. Convocations for those events — the single source of truth for both the
                // aggregate breakdown and "my status" (see the response's doc comment above).
                var convocationsByEvent = await _db.Convocations.AsNoTracking()
                    .Where(c => authorizedEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.Id, c.SportEventId, c.TeamPlayerId, c.ConvocationStatusId })
                    .ToListAsync(cancellationToken);

                // Same "injured for this event" rule as GetEventConvocations: the convocation page
                // lists injured convocados under "Desconvocados", so they count as NotGoing here.
                var convokedTeamPlayerIds = convocationsByEvent.Select(c => c.TeamPlayerId).Distinct().ToList();
                var injuries = await _db.TeamPlayerInjuries.AsNoTracking()
                    .Where(i => convokedTeamPlayerIds.Contains(i.TeamPlayerId))
                    .Select(i => new { i.TeamPlayerId, i.StartDate, i.EndDate })
                    .ToListAsync(cancellationToken);
                var playedMinutes = (await _db.MatchParticipations.AsNoTracking()
                    .Where(mp => authorizedEventIds.Contains(mp.EventId) && mp.MinutesPlayed > 0)
                    .Select(mp => new { mp.EventId, mp.TeamPlayerId })
                    .ToListAsync(cancellationToken))
                    .Select(mp => (mp.EventId, mp.TeamPlayerId))
                    .ToHashSet();

                bool IsInjuredForEvent(string eventId, string teamPlayerId, DateTime eventDate) =>
                    injuries.Any(i => i.TeamPlayerId == teamPlayerId &&
                        (i.StartDate.Date < eventDate ||
                         (i.StartDate.Date == eventDate && !playedMinutes.Contains((eventId, teamPlayerId)))) &&
                        (i.EndDate == null || i.EndDate.Value.Date >= eventDate));

                // 3. My own linked player, only for Player/FamilyMember.
                string? myTeamPlayerId = null;
                if (_currentUser != null)
                {
                    var roles = (_currentUser.Roles ?? Enumerable.Empty<string>()).ToArray();
                    if (roles.Any(r => RestrictedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
                    {
                        myTeamPlayerId = await _db.Set<UserTeam>().AsNoTracking()
                            .Where(ut => ut.ApplicationUserId == _currentUser.UserId && ut.TeamId == request.TeamId)
                            .Select(ut => ut.LinkedTeamPlayerId)
                            .FirstOrDefaultAsync(cancellationToken);
                    }
                }

                var myIsInjured = false;
                if (myTeamPlayerId is not null)
                {
                    var now = DateTime.UtcNow;
                    myIsInjured = await _db.TeamPlayerInjuries.AsNoTracking()
                        .AnyAsync(i => i.TeamPlayerId == myTeamPlayerId &&
                                       i.StartDate <= now &&
                                       (i.EndDate == null || i.EndDate > now), cancellationToken);
                }

                var myAvailabilityByEvent = myTeamPlayerId is null
                    ? new Dictionary<string, (string Id, int StatusId)>()
                    : (await _db.AvailabilityRequests.AsNoTracking()
                        .Where(r => r.TeamPlayerId == myTeamPlayerId && authorizedEventIds.Contains(r.SportEventId))
                        .Select(r => new { r.SportEventId, r.Id, r.StatusId })
                        .ToListAsync(cancellationToken))
                        .ToDictionary(r => r.SportEventId, r => (r.Id, r.StatusId));

                var pendingId = ConvocationStatus.FromName("Pending").Id;
                var acceptedId = ConvocationStatus.FromName("Accepted").Id;
                var justifiedId = ConvocationStatus.FromName("Justified").Id;
                var deconvokeId = ConvocationStatus.FromName("Deconvoke").Id;

                // 4. Build one response per authorized event id (including events with zero convocados).
                var results = new List<EventAttendanceSummaryResponse>();
                foreach (var sportEvent in authorizedEvents)
                {
                    var eventId = sportEvent.Id;
                    var eventDate = sportEvent.EveDateTime?.Date ?? DateTime.UtcNow.Date;
                    var eventConvocations = convocationsByEvent
                        .Where(c => c.SportEventId == eventId)
                        .ToList();

                    var convocados = eventConvocations.Count;
                    var going = 0; var pending = 0; var notGoing = 0;
                    foreach (var c in eventConvocations)
                    {
                        var statusId = c.ConvocationStatusId ?? pendingId;
                        if (IsInjuredForEvent(eventId, c.TeamPlayerId, eventDate)) notGoing++;
                        else if (statusId == acceptedId) going++;
                        else if (statusId == deconvokeId || statusId == justifiedId) notGoing++;
                        else pending++;
                    }

                    var percentage = convocados == 0 ? 0 : Math.Round(going * 100.0 / convocados, 1);

                    string? myStatus = null; int? myStatusId = null; string? myConvocationId = null;
                    if (myTeamPlayerId is not null)
                    {
                        var mine = eventConvocations.FirstOrDefault(c => c.TeamPlayerId == myTeamPlayerId);
                        if (mine is not null)
                        {
                            var sid = mine.ConvocationStatusId ?? pendingId;
                            myStatus = ResolveStatusName(sid, pendingId, acceptedId, justifiedId, deconvokeId);
                            myStatusId = sid;
                            myConvocationId = mine.Id;
                        }
                    }

                    string? myAvailabilityRequestId = null; string? myAvailabilityStatus = null;
                    if (myAvailabilityByEvent.TryGetValue(eventId, out var myAvailability))
                    {
                        myAvailabilityRequestId = myAvailability.Id;
                        myAvailabilityStatus = AvailabilityRequestStatus.From(myAvailability.StatusId).Name;
                    }

                    results.Add(new EventAttendanceSummaryResponse(
                        eventId, convocados, going, pending, notGoing, percentage, myStatus, myStatusId, myConvocationId, myIsInjured,
                        myAvailabilityRequestId, myAvailabilityStatus));
                }

                return results.ToArray();
            }

            // Defensive name resolution: does not throw on an unrecognized status id (unlike
            // ConvocationStatus.From), falling back to "Pending" — matches this handler's own
            // bucketing default for the aggregate counts above.
            private static string ResolveStatusName(int statusId, int pendingId, int acceptedId, int justifiedId, int deconvokeId)
            {
                if (statusId == acceptedId) return "Accepted";
                if (statusId == deconvokeId) return "Deconvoke";
                if (statusId == justifiedId) return "Justified";
                return "Pending";
            }
        }
    }
}
