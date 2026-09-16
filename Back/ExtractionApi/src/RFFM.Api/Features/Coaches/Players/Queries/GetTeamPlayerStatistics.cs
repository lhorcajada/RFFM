using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns, per player on a team, season totals (goals/cards/minutes) plus a windowed
    /// "Rodaje" (0-100) built from recent training attendance and match minutes.
    /// See openspec/changes/squad-statistics-form-status/design.md → Decisión 1 y 3.
    /// </summary>
    public class GetTeamPlayerStatistics : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/player-stats",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId }, ct)))
                .WithName(nameof(GetTeamPlayerStatistics))
                .WithTags("Coaches")
                .Produces<List<PlayerStatisticsDto>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record Query : IQueryApp<List<PlayerStatisticsDto>>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.Squad;
            public string RequiredPermission => "Read";
        }

        public record AttendanceRatioDto(int Attended, int Possible, int CalledButAbsent);

        public record PlayerStatisticsDto(
            string TeamPlayerId,
            string DisplayName,
            string? Position,
            int? Dorsal,
            int Goals,
            int YellowCards,
            int RedCards,
            int MinutesPlayed,
            AttendanceRatioDto Trainings,           // historico de temporada, ratio attended/possible
            AttendanceRatioDto Friendlies,          // historico de temporada, ratio attended/possible
            AttendanceRatioDto League,              // historico de temporada, ratio attended/possible
            int? DaysSinceLastInjury,               // null si no ha tenido ninguna lesión esta temporada
            int? LastInjuryDurationDays,             // null si no ha tenido lesión, o si la más reciente sigue en curso
            double PhysicalFitness,                 // 0-100, Forma física persistida (ver TeamPlayerCondition)
            double Fatigue,                         // 0-100, Cansancio persistido
            double Availability,                    // = max(0, PhysicalFitness - Fatigue)
            int? Readiness,                        // 0-100, null = sin datos suficientes en la ventana
            ReadinessBreakdownDto? ReadinessBreakdown,
            int MatchesAbsentAttributableToPlayer,   // partidos/amistosos/torneos finalizados con ausencia imputable al jugador
            double? MinutesPlayedPercentOfSeasonTotal,            // null si la categoría del equipo no es F11
            double? AttributableAbsentMinutesPercentOfSeasonTotal); // null si la categoría del equipo no es F11

        public record ReadinessBreakdownDto(
            double TrainingComponent,              // 0-100
            double MatchComponent,                 // 0-100
            int TrainingSessionsConsidered,
            int TrainingSessionsBaseline,          // = PlayerReadinessCalculator.BaselineTrainings
            int MatchMinutesInWindow,
            int MatchMinutesExpected,               // = BaselineMatches * ExpectedMinutesPerMatch
            RecentAbsenceDto[] RecentAbsences);

        public record RecentAbsenceDto(string EventId, DateTime? Date, string Reason, int PointsImpact);

        private record TeamPlayerProjection(
            string Id,
            string? Alias,
            string Name,
            string? LastName,
            int? Dorsal,
            int ActivePositionId,
            DateTime JoinedDate,
            DateTime? LeftDate);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db, PlayerConditionRecalculationService conditionService) : IRequestHandler<Query, List<PlayerStatisticsDto>>
        {
            public async ValueTask<List<PlayerStatisticsDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var windowStart = DateTime.UtcNow.AddDays(-7 * PlayerReadinessCalculator.WindowWeeks);
                var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
                var leagueEventTypeId = SportEventsConstants.MatchEventTypeId;    // 1
                var friendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId; // 4

                var teamPlayers = await db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .OrderBy(tp => tp.Player.Name)
                    .ThenBy(tp => tp.Player.LastName)
                    .Select(tp => new TeamPlayerProjection(
                        tp.Id,
                        tp.Player.Alias,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Dorsal != null ? tp.Dorsal.Number : (int?)null,
                        tp.Demarcation != null ? tp.Demarcation.ActivePositionId : 0,
                        tp.JoinedDate,
                        tp.LeftDate))
                    .ToListAsync(cancellationToken);

                // Season totals (goals/cards/minutes) — same as GetSeasonPlayerStats / GetPlayerSeasonCards.
                var finishedParticipations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
                    .ToListAsync(cancellationToken);

                var participationsByPlayer = finishedParticipations
                    .GroupBy(mp => mp.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // 8-week window for the match component of the form status. Any finished match
                // participation counts here (Partido/Amistoso/Torneo) — a friendly still costs
                // real physical effort even though it's excluded from official-match season
                // stats/discipline counters elsewhere (GetSeasonPlayerStats, card suspensions).
                var matchEventIdsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EveDateTime >= windowStart)
                    .Select(se => se.Id)
                    .ToListAsync(cancellationToken);
                var matchEventIdsInWindowSet = matchEventIdsInWindow.ToHashSet();

                var participationsInWindow = finishedParticipations
                    .Where(mp => matchEventIdsInWindowSet.Contains(mp.EventId))
                    .ToList();
                var matchMinutesInWindowByPlayer = participationsInWindow
                    .GroupBy(mp => mp.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.Select(mp => mp.MinutesPlayed).ToList());

                // 8-week window for the training component of the form status.
                var trainingEventsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == trainingEventTypeId
                                 && se.EveDateTime >= windowStart)
                    .Select(se => new { se.Id, se.EveDateTime })
                    .ToListAsync(cancellationToken);
                var trainingEventDateById = trainingEventsInWindow.ToDictionary(e => e.Id, e => e.EveDateTime);
                var trainingEventIds = trainingEventsInWindow.Select(e => e.Id).ToList();

                var trainingConvocationsInWindow = await db.Convocations
                    .AsNoTracking()
                    .Where(c => trainingEventIds.Contains(c.SportEventId))
                    .ToListAsync(cancellationToken);
                var trainingConvocationsByPlayer = trainingConvocationsInWindow
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Season totals (full history, not windowed) — attendance ratios per event type.
                // Query for all finished events (EveDateTime < DateTime.UtcNow) of the three event types
                var finishedEvents = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId
                                 && se.EveDateTime != null && se.EveDateTime < DateTime.UtcNow
                                 && (se.EventTypeId == trainingEventTypeId
                                     || se.EventTypeId == leagueEventTypeId
                                     || se.EventTypeId == friendlyEventTypeId))
                    .Select(se => new { se.Id, se.EventTypeId, EveDate = se.EveDateTime!.Value })
                    .ToListAsync(cancellationToken);

                var finishedEventIds = finishedEvents.Select(e => e.Id).ToList();
                var finishedEventById = finishedEvents.ToDictionary(e => e.Id, e => e);

                // Attendance tracking:
                // For trainings: via Convocation (Attendance or LateArrival)
                // For matches: via MatchParticipation (physical presence in the match)
                var convocationsForFinishedEvents = await db.Convocations
                    .AsNoTracking()
                    .Where(c => finishedEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.TeamPlayerId, c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                    .ToListAsync(cancellationToken);

                var matchParticipationsForFinishedEvents = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => finishedEventIds.Contains(mp.EventId) && mp.MatchPhase == "finished")
                    .Select(mp => new { mp.TeamPlayerId, mp.EventId })
                    .ToListAsync(cancellationToken);

                // Per-player set of distinct event ids actually attended, so attendance can be
                // bounded by JoinedDate/LeftDate the same way "possible" is (a convocation dated
                // before a player joined the squad — e.g. a stale/migrated record — must not
                // count as an attendance). A HashSet<string> (not a list) is required here: a
                // match event commonly has BOTH a Convocation (Attendance) row AND a
                // MatchParticipation row, so without dedup by event id the same match would be
                // counted twice ("Attended" could then exceed "Possible", e.g. "3 de 2").
                var attendedEventsByPlayer = new Dictionary<string, HashSet<string>>();

                void AddAttendedEvent(string teamPlayerId, string eventId)
                {
                    if (!attendedEventsByPlayer.TryGetValue(teamPlayerId, out var set))
                    {
                        set = new HashSet<string>();
                        attendedEventsByPlayer[teamPlayerId] = set;
                    }
                    set.Add(eventId);
                }

                // Convocation-based attendance (trainings primarily)
                foreach (var conv in convocationsForFinishedEvents
                    .Where(c => c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id))
                {
                    AddAttendedEvent(conv.TeamPlayerId, conv.SportEventId);
                }

                // Participation-based attendance (matches primarily, but also used for other events)
                foreach (var part in matchParticipationsForFinishedEvents)
                {
                    AddAttendedEvent(part.TeamPlayerId, part.EventId);
                }

                // Per-player list of (EventTypeId, EveDate) for events where the absence is
                // attributable to the player (accepted then no-show, or deconvoked for a reason
                // other than the coach's technical decision) — surfaced alongside the ratio so a
                // low "attended/possible" number can be explained as "called up but absent"
                // rather than "never called". Same definition as the season minutes-target's
                // attributable-absence count below (AttributableAbsenceCalculator).
                var absentEventsByPlayer = new Dictionary<string, List<(int EventTypeId, DateTime EveDate)>>();

                void AddAbsentEvent(string teamPlayerId, string eventId)
                {
                    var evt = finishedEventById[eventId];
                    if (!absentEventsByPlayer.TryGetValue(teamPlayerId, out var list))
                    {
                        list = new List<(int, DateTime)>();
                        absentEventsByPlayer[teamPlayerId] = list;
                    }
                    list.Add((evt.EventTypeId, evt.EveDate));
                }

                foreach (var conv in convocationsForFinishedEvents
                    .Where(c => AttributableAbsenceCalculator.IsAttributableAbsence(c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId)))
                {
                    AddAbsentEvent(conv.TeamPlayerId, conv.SportEventId);
                }

                // Season minutes-target: only computed for F11 categories (Juveniles/Cadetes/
                // Infantiles/Alevines). See openspec/changes/squad-statistics-minutes-target-mobile-layout.
                var teamCategoryId = await db.Teams
                    .AsNoTracking()
                    .Where(t => t.Id == request.TeamId)
                    .Select(t => t.CategoryId)
                    .SingleAsync(cancellationToken);
                var hasStandardMinutes = MatchDurationMinutesByCategory.TryGetMinutes(teamCategoryId, out var standardMinutes);

                var matchLikeEventTypeIds = new[]
                {
                    SportEventsConstants.MatchEventTypeId,
                    SportEventsConstants.FriendlyEventTypeId,
                    SportEventsConstants.TournamentEventTypeId
                };

                var matchLikeFinishedEventIds = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId
                                 && se.EveDateTime != null && se.EveDateTime < DateTime.UtcNow
                                 && matchLikeEventTypeIds.Contains(se.EventTypeId))
                    .Select(se => se.Id)
                    .ToListAsync(cancellationToken);
                var matchLikeFinishedEventIdSet = matchLikeFinishedEventIds.ToHashSet();

                // Per-event duration = the real registered duration (max minutes played among
                // that event's finished participations) — always authoritative, whether shorter
                // than the category standard (common in amistosos) or longer (prórroga/tiempo
                // añadido). The category standard is only used to gate which teams get this
                // stat at all (F11 categories); it never caps a real match's duration, otherwise
                // a player's own minutes could exceed the capped total and push the percentage
                // past 100%. Events with no recorded participation are skipped (nothing played yet).
                var matchDurationByEventId = new Dictionary<string, int>();
                int? seasonTotalPossibleMinutes = null;
                if (hasStandardMinutes)
                {
                    seasonTotalPossibleMinutes = 0;
                    foreach (var group in finishedParticipations
                        .Where(mp => matchLikeFinishedEventIdSet.Contains(mp.EventId))
                        .GroupBy(mp => mp.EventId))
                    {
                        var duration = group.Max(mp => mp.MinutesPlayed);
                        matchDurationByEventId[group.Key] = duration;
                        seasonTotalPossibleMinutes += duration;
                    }
                }

                var matchLikeConvocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => matchLikeFinishedEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.TeamPlayerId, c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                    .ToListAsync(cancellationToken);

                var attributableAbsencesByPlayer = matchLikeConvocations
                    .Where(c => AttributableAbsenceCalculator.IsAttributableAbsence(c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId))
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.Select(c => c.SportEventId).ToList());

                // Most recent injury per player (TeamPlayer is already scoped to this team+season).
                var teamPlayerIds = teamPlayers.Select(tp => tp.Id).ToList();
                var injuries = await db.TeamPlayerInjuries
                    .AsNoTracking()
                    .Where(i => teamPlayerIds.Contains(i.TeamPlayerId))
                    .ToListAsync(cancellationToken);
                var mostRecentInjuryByPlayer = injuries
                    .GroupBy(i => i.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.StartDate).First());

                var result = new List<PlayerStatisticsDto>(teamPlayers.Count);
                foreach (var player in teamPlayers)
                {
                    participationsByPlayer.TryGetValue(player.Id, out var playerParticipations);
                    playerParticipations ??= new List<Domain.Entities.TeamPlayers.MatchParticipation>();

                    var goals = playerParticipations.Sum(mp => CountGoalsForPlayer(mp.GoalsJson, player.Id));
                    var yellowCards = playerParticipations.Sum(mp => PlayerCardCountService.CountCards(mp.CardsJson, player.Id, "Yellow"));
                    var redCards = playerParticipations.Sum(mp => PlayerCardCountService.CountCards(mp.CardsJson, player.Id, "Red"));
                    var minutesPlayed = playerParticipations.Sum(mp => mp.MinutesPlayed);

                    trainingConvocationsByPlayer.TryGetValue(player.Id, out var playerTrainingConvocations);
                    playerTrainingConvocations ??= new List<Convocation>();

                    var trainingOutcomes = playerTrainingConvocations
                        .Select(c => new PlayerReadinessCalculator.TrainingOutcome(
                            c.SportEventId,
                            trainingEventDateById.TryGetValue(c.SportEventId, out var date) ? date : null,
                            c.AssistanceTypeId,
                            c.ExcuseTypeId,
                            c.ConvocationStatusId))
                        .ToList();

                    matchMinutesInWindowByPlayer.TryGetValue(player.Id, out var matchMinutesInWindow);
                    matchMinutesInWindow ??= new List<int>();

                    var readinessResult = PlayerReadinessCalculator.Calculate(trainingOutcomes, matchMinutesInWindow);

                    // Attendance ratio helpers
                    int PossibleFor(int eventTypeId) => finishedEvents.Count(e =>
                        e.EventTypeId == eventTypeId
                        && e.EveDate >= player.JoinedDate
                        && (player.LeftDate == null || e.EveDate <= player.LeftDate));

                    int AttendedFor(int eventTypeId) => attendedEventsByPlayer.TryGetValue(player.Id, out var eventIds)
                        ? eventIds.Count(eventId =>
                        {
                            var e = finishedEventById[eventId];
                            return e.EventTypeId == eventTypeId
                                && e.EveDate >= player.JoinedDate
                                && (player.LeftDate == null || e.EveDate <= player.LeftDate);
                        })
                        : 0;

                    int CalledButAbsentFor(int eventTypeId) => absentEventsByPlayer.TryGetValue(player.Id, out var evs)
                        ? evs.Count(e => e.EventTypeId == eventTypeId
                            && e.EveDate >= player.JoinedDate
                            && (player.LeftDate == null || e.EveDate <= player.LeftDate))
                        : 0;

                    var trainings = new AttendanceRatioDto(AttendedFor(trainingEventTypeId), PossibleFor(trainingEventTypeId), CalledButAbsentFor(trainingEventTypeId));
                    var friendlies = new AttendanceRatioDto(AttendedFor(friendlyEventTypeId), PossibleFor(friendlyEventTypeId), CalledButAbsentFor(friendlyEventTypeId));
                    var league = new AttendanceRatioDto(AttendedFor(leagueEventTypeId), PossibleFor(leagueEventTypeId), CalledButAbsentFor(leagueEventTypeId));

                    int? daysSinceLastInjury = null;
                    int? lastInjuryDurationDays = null;
                    if (mostRecentInjuryByPlayer.TryGetValue(player.Id, out var lastInjury))
                    {
                        daysSinceLastInjury = (int)(DateTime.UtcNow - lastInjury.StartDate).TotalDays;
                        lastInjuryDurationDays = lastInjury.EndDate.HasValue
                            ? (int)(lastInjury.EndDate.Value - lastInjury.StartDate).TotalDays
                            : null;
                    }

                    var condition = await conditionService.RecalculateAsync(player.Id, DateTime.UtcNow, cancellationToken);
                    var availability = Math.Max(0, condition.PhysicalFitness - condition.Fatigue);

                    attributableAbsencesByPlayer.TryGetValue(player.Id, out var playerAttributableAbsenceEventIds);
                    playerAttributableAbsenceEventIds ??= new List<string>();
                    var matchesAbsentAttributableToPlayer = playerAttributableAbsenceEventIds.Count;

                    double? minutesPlayedPercentOfSeasonTotal = null;
                    double? attributableAbsentMinutesPercentOfSeasonTotal = null;
                    if (hasStandardMinutes)
                    {
                        var attributableAbsentMinutes = playerAttributableAbsenceEventIds
                            .Sum(eventId => matchDurationByEventId.TryGetValue(eventId, out var d) ? d : 0);

                        // Numerator scoped to exactly the same event set as the denominator
                        // (matchLikeFinishedEventIdSet), not the broader season-wide `minutesPlayed`
                        // above (which also counts events outside that set, e.g. with EveDateTime
                        // still null) — otherwise the percentage could mathematically exceed 100%.
                        var minutesPlayedInSeasonTotalScope = playerParticipations
                            .Where(mp => matchLikeFinishedEventIdSet.Contains(mp.EventId))
                            .Sum(mp => mp.MinutesPlayed);

                        minutesPlayedPercentOfSeasonTotal = seasonTotalPossibleMinutes is null or 0
                            ? null
                            : Math.Round(100.0 * minutesPlayedInSeasonTotalScope / seasonTotalPossibleMinutes.Value, 1);
                        attributableAbsentMinutesPercentOfSeasonTotal = seasonTotalPossibleMinutes is null or 0
                            ? null
                            : Math.Round(100.0 * attributableAbsentMinutes / seasonTotalPossibleMinutes.Value, 1);
                    }

                    string? position = player.ActivePositionId != 0
                        ? DemarcationMaster.GetById(player.ActivePositionId)?.Name
                        : null;

                    var displayName = !string.IsNullOrWhiteSpace(player.Alias)
                        ? player.Alias
                        : string.Join(" ", new[] { player.Name, player.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();

                    var readinessBreakdown = new ReadinessBreakdownDto(
                        readinessResult.TrainingComponent,
                        readinessResult.MatchComponent,
                        readinessResult.SessionsConsidered,
                        PlayerReadinessCalculator.BaselineTrainings,
                        readinessResult.MatchMinutesInWindow,
                        PlayerReadinessCalculator.BaselineMatches * PlayerReadinessCalculator.ExpectedMinutesPerMatch,
                        readinessResult.RecentAbsences
                            .Select(a => new RecentAbsenceDto(a.EventId, a.Date, a.Reason, a.PointsImpact))
                            .ToArray());

                    result.Add(new PlayerStatisticsDto(
                        player.Id,
                        string.IsNullOrWhiteSpace(displayName) ? "Jugador" : displayName,
                        position,
                        player.Dorsal,
                        goals,
                        yellowCards,
                        redCards,
                        minutesPlayed,
                        trainings,
                        friendlies,
                        league,
                        daysSinceLastInjury,
                        lastInjuryDurationDays,
                        condition.PhysicalFitness,
                        condition.Fatigue,
                        availability,
                        readinessResult.Readiness,
                        readinessBreakdown,
                        matchesAbsentAttributableToPlayer,
                        minutesPlayedPercentOfSeasonTotal,
                        attributableAbsentMinutesPercentOfSeasonTotal));
                }

                return result;
            }

            /// <summary>
            /// Parses GoalsJson to count goals where scorerId == teamPlayerId and isOwnTeam == true.
            /// Same logic as GetSeasonPlayerStats.CountGoalsForPlayer / GetPlayerSeasonCards.CountGoalsForPlayer.
            /// Returns 0 for null/malformed JSON.
            /// </summary>
            private static int CountGoalsForPlayer(string? goalsJson, string teamPlayerId)
            {
                if (string.IsNullOrEmpty(goalsJson)) return 0;

                try
                {
                    using var doc = JsonDocument.Parse(goalsJson);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                    var count = 0;
                    foreach (var goal in doc.RootElement.EnumerateArray())
                    {
                        var isOwnTeam = goal.TryGetProperty("isOwnTeam", out var ownProp) && ownProp.GetBoolean();
                        var scorerId = goal.TryGetProperty("scorerId", out var idProp) ? idProp.GetString() : null;

                        if (isOwnTeam && scorerId == teamPlayerId)
                            count++;
                    }
                    return count;
                }
                catch
                {
                    return 0;
                }
            }
        }
    }
}
