using System.Linq.Expressions;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Aggregate convocation/participation summary for a team player, used by the player
    /// "Estadísticas" tab: how many matches they started, how many times they were called up
    /// in total (and broken down by training/friendly/league), and the most recent match they
    /// missed for each of the two distinct absence reasons — a coach decision (ConvocationStatus
    /// Deconvoke) versus being accepted but not attending on the day (AssistanceType
    /// Excused/UnexcusedAbsence, set via the "Asistencia" flow). Kept as its own read-model
    /// endpoint (rather than folded into GetPlayerMatchHistory) because it answers a different
    /// question — aggregates and non-participation events — over a different query shape
    /// (Convocations, not just finished MatchParticipations).
    /// </summary>
    public class GetPlayerConvocationSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team-player/{teamPlayerId}/convocation-summary",
                    async (string teamPlayerId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetPlayerConvocationSummary))
                .WithTags("MatchParticipation")
                .Produces<PlayerConvocationSummaryDto>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record PlayerConvocationSummaryQuery : Common.IQueryApp<PlayerConvocationSummaryDto>
        {
            public string TeamPlayerId { get; init; } = null!;
        }

        public record PlayerConvocationSummaryDto(
            int TotalStarts,
            AttendanceRatioDto Trainings,
            AttendanceRatioDto Friendlies,
            AttendanceRatioDto League,
            PlayerAbsenceMatchDto? LastDeconvokedMatch,
            PlayerAbsenceMatchDto? LastAbsenceMatch);

        /// <summary>Attended vs. Possible (finished events of that type since the player joined
        /// the squad), plus how many of those the player was called up for but did not attend.
        /// Same shape/semantics as GetTeamPlayerStatistics.AttendanceRatioDto.</summary>
        public record AttendanceRatioDto(int Attended, int Possible, int CalledButAbsent);

        public record PlayerAbsenceMatchDto(
            string EventId,
            DateTime? MatchDate,
            string? RivalName,
            int EventTypeId,
            string EventTypeName,
            string? Reason);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<PlayerConvocationSummaryQuery, PlayerConvocationSummaryDto>
        {
            private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
            private static readonly int ExcusedAbsenceTypeId = AssistanceType.ExcusedAbsence.Id;
            private static readonly int UnexcusedAbsenceTypeId = AssistanceType.UnexcusedAbsence.Id;

            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<PlayerConvocationSummaryDto> Handle(
                PlayerConvocationSummaryQuery request,
                CancellationToken cancellationToken = default)
            {
                var totalStarts = await _db.MatchParticipations
                    .AsNoTracking()
                    .CountAsync(mp => mp.TeamPlayerId == request.TeamPlayerId && mp.MatchPhase == "finished" && mp.IsStarter, cancellationToken);

                var teamPlayer = await _db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.Id == request.TeamPlayerId)
                    .Select(tp => new { tp.TeamId, tp.JoinedDate, tp.LeftDate })
                    .SingleAsync(cancellationToken);

                var eventTypeIds = new[] { SportEventType.TrainingId, SportEventsConstants.FriendlyEventTypeId, SportEventsConstants.MatchEventTypeId };
                var finishedEvents = await _db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == teamPlayer.TeamId
                                 && se.EveDateTime != null && se.EveDateTime < DateTime.UtcNow
                                 && eventTypeIds.Contains(se.EventTypeId))
                    .Select(se => new { se.Id, se.EventTypeId, EveDate = se.EveDateTime!.Value })
                    .ToListAsync(cancellationToken);
                var finishedEventById = finishedEvents.ToDictionary(e => e.Id, e => e);
                var finishedEventIds = finishedEvents.Select(e => e.Id).ToList();

                var playerConvocations = await _db.Convocations
                    .AsNoTracking()
                    .Where(c => c.TeamPlayerId == request.TeamPlayerId && finishedEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                    .ToListAsync(cancellationToken);

                var playerParticipations = await _db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamPlayerId == request.TeamPlayerId && mp.MatchPhase == "finished" && finishedEventIds.Contains(mp.EventId))
                    .Select(mp => mp.EventId)
                    .ToListAsync(cancellationToken);

                // Dedup by event id: a match commonly has BOTH a Convocation(Attendance) row and a
                // MatchParticipation row for the same event — without this, "Attended" could exceed
                // "Possible" (see GetTeamPlayerStatistics for the same fix, same root cause).
                var attendedEventIds = playerConvocations
                    .Where(c => c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id)
                    .Select(c => c.SportEventId)
                    .Concat(playerParticipations)
                    .ToHashSet();

                // Same "attributable to the player" definition as GetTeamPlayerStatistics'
                // season minutes-target: no-show on the day, OR deconvoked for a reason other
                // than the coach's technical decision. Never convoked doesn't count.
                var calledButAbsentEventIds = playerConvocations
                    .Where(c => AttributableAbsenceCalculator.IsAttributableAbsence(c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId))
                    .Select(c => c.SportEventId)
                    .ToHashSet();

                bool InPlayerWindow(DateTime eveDate) =>
                    eveDate >= teamPlayer.JoinedDate && (teamPlayer.LeftDate == null || eveDate <= teamPlayer.LeftDate);

                AttendanceRatioDto RatioFor(int eventTypeId)
                {
                    var possible = finishedEvents.Count(e => e.EventTypeId == eventTypeId && InPlayerWindow(e.EveDate));
                    var attended = attendedEventIds.Count(id =>
                        finishedEventById.TryGetValue(id, out var e) && e.EventTypeId == eventTypeId && InPlayerWindow(e.EveDate));
                    var calledButAbsent = calledButAbsentEventIds.Count(id =>
                        finishedEventById.TryGetValue(id, out var e) && e.EventTypeId == eventTypeId && InPlayerWindow(e.EveDate));
                    return new AttendanceRatioDto(attended, possible, calledButAbsent);
                }

                var trainings = RatioFor(SportEventType.TrainingId);
                var friendlies = RatioFor(SportEventsConstants.FriendlyEventTypeId);
                var league = RatioFor(SportEventsConstants.MatchEventTypeId);

                var lastDeconvokedMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId,
                    c => c.ConvocationStatusId == DeconvokeStatusId,
                    cancellationToken);

                var lastAbsenceMatch = await GetMostRecentAbsenceMatchAsync(
                    request.TeamPlayerId,
                    c => c.AssistanceTypeId == ExcusedAbsenceTypeId || c.AssistanceTypeId == UnexcusedAbsenceTypeId,
                    cancellationToken);

                return new PlayerConvocationSummaryDto(
                    totalStarts,
                    trainings,
                    friendlies,
                    league,
                    lastDeconvokedMatch,
                    lastAbsenceMatch);
            }

            private async Task<PlayerAbsenceMatchDto?> GetMostRecentAbsenceMatchAsync(
                string teamPlayerId,
                Expression<Func<Convocation, bool>> absencePredicate,
                CancellationToken cancellationToken)
            {
                var convocation = await _db.Convocations
                    .AsNoTracking()
                    .Include(c => c.SportEvent)
                    .ThenInclude(se => se.Rival)
                    .Include(c => c.ExcuseType)
                    .Where(c => c.TeamPlayerId == teamPlayerId)
                    .Where(absencePredicate)
                    .OrderByDescending(c => c.SportEvent.EveDateTime ?? DateTime.MinValue)
                    .FirstOrDefaultAsync(cancellationToken);

                if (convocation is null) return null;

                var eventTypeId = convocation.SportEvent.EventTypeId;
                return new PlayerAbsenceMatchDto(
                    convocation.SportEventId,
                    convocation.SportEvent.EveDateTime,
                    convocation.SportEvent.Rival?.Name,
                    eventTypeId,
                    SportEventType.From(eventTypeId).Name,
                    convocation.ExcuseType?.Name);
            }
        }
    }
}
