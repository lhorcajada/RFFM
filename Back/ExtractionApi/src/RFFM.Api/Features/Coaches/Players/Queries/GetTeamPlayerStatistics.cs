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
            int Fatigue,                            // 0-100, Cansancio derivado con decaimiento por recencia (ver PlayerFatigueCalculator)
            FatigueBreakdownDto FatigueBreakdown,   // nunca null: Fatigue siempre tiene valor (0 cuando no hay eventos)
            int? Readiness,                        // 0-100, Rodaje; null = sin actividad en los últimos 84 días
            DailyLoadBreakdownDto? ReadinessBreakdown,  // null cuando Readiness es null
            int MatchesAbsentAttributableToPlayer,   // partidos/amistosos/torneos finalizados con ausencia imputable al jugador
            double? MinutesPlayedPercentOfSeasonTotal,            // null si la categoría del equipo no es F11
            double? AttributableAbsentMinutesPercentOfSeasonTotal, // null si la categoría del equipo no es F11
            int? FormStatus,                              // 0-100, Estado de forma; null = sin actividad en los últimos 84 días o categoría sin duración estándar de partido
            DailyLoadBreakdownDto? FormStatusBreakdown);   // null cuando FormStatus es null

        public record ReadinessBreakdownDto(
            double TrainingComponent,              // 0-100
            double MatchComponent,                 // 0-100
            int TrainingSessionsConsidered,
            int TrainingSessionsBaseline,          // = PlayerReadinessCalculator.BaselineTrainings
            int MatchMinutesInWindow,               // suma ponderada por tipo de partido, no minutos reales (ver PlayerReadinessCalculator.Result.MatchMinutesInWindow)
            int MatchMinutesExpected,               // = BaselineMatches * ExpectedMinutesPerMatch
            // Peso del bloque completo (0-1) dentro del cálculo final, expuesto para que el
            // frontend componga "Entrenamientos (peso 70% del total)" sin hardcodear el número —
            // ver design.md → "Transparencia del desglose".
            double TrainingWeight,                  // = PlayerReadinessCalculator.TrainingWeight (0.70)
            double MatchWeight,                     // = PlayerReadinessCalculator.MatchWeight (0.30)
            RecentAbsenceDto[] RecentAbsences,
            // Lista completa de sesiones/partidos considerados (asistencias Y ausencias), ver
            // PlayerReadinessCalculator.ConsideredTraining/ConsideredMatch. RecentAbsences se
            // mantiene sin cambios para no romper a quien ya lo consumía.
            ReadinessConsideredTrainingDto[] ConsideredTrainings,
            ReadinessConsideredMatchDto[] ConsideredMatches);

        public record RecentAbsenceDto(string EventId, DateTime? Date, string Reason, int PointsImpact);

        public record ReadinessConsideredTrainingDto(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            bool CountsTowardScore, double Points, double TypeWeight, double Contribution, string Reason);

        public record ReadinessConsideredMatchDto(
            string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
            double TypeWeight, double EffectiveMinutes);

        public record FatigueBreakdownDto(
            double TrainingComponent,       // 0-100
            double MatchComponent,          // 0-100
            double DecayedTrainingCount,    // suma ponderada por Decay(diasDesde) y tipo de entreno (ver PlayerFatigueCalculator.Result)
            double DecayedMatchMinutes,     // suma ponderada por minutos, Decay(diasDesde) y tipo de partido (ver PlayerFatigueCalculator.Result)
            double TrainingWeight,          // = PlayerFatigueCalculator.TrainingWeight (0.40)
            double MatchWeight,             // = PlayerFatigueCalculator.MatchWeight (0.60)
            FatigueConsideredTrainingDto[] ConsideredTrainings,
            FatigueConsideredMatchDto[] ConsideredMatches);

        public record FatigueConsideredTrainingDto(
            string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
            int DaysAgo, double Decay, double TypeWeight, double Contribution);

        public record FatigueConsideredMatchDto(
            string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
            int DaysAgo, double Decay, double TypeWeight, double EffectiveMinutes);

        // Desglose común de Estado de forma y Rodaje (modelo de carga diaria). Ver
        // openspec/changes/player-form-readiness-daily-load-model/design.md → Decisión 5.
        public record DailyLoadBreakdownDto(
            double Value,                          // sin redondear
            DateTime ReplayStartDate,
            int ReplayDays,                        // 84
            double GainRate,
            int GraceRestDays,
            double DecayStepPerDay,
            double DecayMaxPerDay,
            double MatchLoadPerReferenceMatch,     // 1.5
            double ReferenceMatchMinutes,          // EF: minutos de estímulo completo de la categoría; Rodaje: 70
            int CurrentRestStreakDays,             // días seguidos sin actividad hasta hoy
            int TrainingsAttended,
            int MatchesPlayed,
            int MatchMinutesPlayed,
            DailyLoadStepDto[] Steps,              // más reciente primero
            MissedEventDto[] MissedEvents);        // más reciente primero, máx. 10

        public record DailyLoadStepDto(
            DateTime Date, DateTime? EndDate, string Kind,   // "Activity" | "Decay"
            double Load, double ValueBefore, double ValueAfter,
            DailyLoadEventDto[] Events);

        public record DailyLoadEventDto(
            string EventId, int EventTypeId, IReadOnlyList<string> TrainingTypes,
            int MinutesPlayed, double TypeWeight, double Load);

        public record MissedEventDto(string EventId, DateTime Date, int EventTypeId, string Reason);

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

        public class Handler(AppDbContext db) : IRequestHandler<Query, List<PlayerStatisticsDto>>
        {
            public async ValueTask<List<PlayerStatisticsDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var today = DateTime.UtcNow.Date;
                var windowStart = today.AddDays(-(DailyLoadModel.ReplayDays - 1));
                var fatigueWindowStart = DateTime.UtcNow.AddDays(-PlayerFatigueCalculator.WindowDays);
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

                // 84-day replay window for Estado de forma/Rodaje (DailyLoadModel). Any finished match
                // participation counts here (Partido/Amistoso/Torneo) — a friendly still costs
                // real physical effort even though it's excluded from official-match season
                // stats/discipline counters elsewhere (GetSeasonPlayerStats, card suspensions).
                var matchEventsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EveDateTime >= windowStart)
                    .Select(se => new { se.Id, se.EveDateTime, se.EventTypeId })
                    .ToListAsync(cancellationToken);
                var matchEventDateById = matchEventsInWindow.ToDictionary(e => e.Id, e => e.EveDateTime);
                var matchEventEventTypeById = matchEventsInWindow.ToDictionary(e => e.Id, e => e.EventTypeId);
                var matchEventIdsInWindowSet = matchEventDateById.Keys.ToHashSet();

                var participationsInWindow = finishedParticipations
                    .Where(mp => matchEventIdsInWindowSet.Contains(mp.EventId))
                    .ToList();
                // 84-day replay window for the training component of Estado de forma/Rodaje.
                var trainingEventsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == trainingEventTypeId
                                 && se.EveDateTime >= windowStart)
                    .Select(se => new { se.Id, se.EveDateTime, se.TrainingTypes })
                    .ToListAsync(cancellationToken);
                var trainingEventDateById = trainingEventsInWindow.ToDictionary(e => e.Id, e => e.EveDateTime);
                var trainingEventTrainingTypesById = trainingEventsInWindow.ToDictionary(e => e.Id, e => e.TrainingTypes);
                var trainingEventIds = trainingEventsInWindow.Select(e => e.Id).ToList();

                var trainingConvocationsInWindow = await db.Convocations
                    .AsNoTracking()
                    .Where(c => trainingEventIds.Contains(c.SportEventId))
                    .ToListAsync(cancellationToken);
                var trainingConvocationsByPlayer = trainingConvocationsInWindow
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Load window for Cansancio (PlayerFatigueCalculator.WindowDays, 14 days) —
                // narrower than the 84-day replay window above, so it is derived in-memory from
                // the data already fetched for Rodaje (a strict superset) instead of issuing new
                // DB queries. Unlike Rodaje, each event keeps its own "days ago" so
                // PlayerFatigueCalculator can apply recency decay instead of a flat count.
                var trainingsAttendedInFatigueWindowByPlayer = trainingConvocationsInWindow
                    .Where(c => (c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id)
                                && trainingEventDateById.TryGetValue(c.SportEventId, out var date) && date >= fatigueWindowStart)
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(c => c.SportEventId).Distinct()
                            .Select(eventId => (
                                EventId: eventId,
                                EventDate: trainingEventDateById[eventId],
                                DaysAgo: (int)(DateTime.UtcNow.Date - trainingEventDateById[eventId]!.Value.Date).TotalDays,
                                TrainingTypes: (IReadOnlyList<string>)trainingEventTrainingTypesById[eventId]))
                            .ToList());

                var matchMinutesInFatigueWindowByPlayer = participationsInWindow
                    .Where(mp => matchEventDateById.TryGetValue(mp.EventId, out var date) && date >= fatigueWindowStart)
                    .GroupBy(mp => mp.TeamPlayerId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(mp => (
                                EventId: mp.EventId,
                                EventDate: matchEventDateById[mp.EventId],
                                DaysAgo: (int)(DateTime.UtcNow.Date - matchEventDateById[mp.EventId]!.Value.Date).TotalDays,
                                mp.MinutesPlayed,
                                EventTypeId: matchEventEventTypeById[mp.EventId]))
                            .ToList());

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

                var matchLikeConvocationByPlayerEvent = matchLikeConvocations
                    .GroupBy(c => (c.TeamPlayerId, c.SportEventId))
                    .ToDictionary(g => g.Key, g => g.First());

                // Partidos del equipo reproducidos para Estado de forma/Rodaje: Liga/Amistoso/Torneo
                // con al menos una participación `finished` dentro de la ventana de 84 días.
                var replayMatches = participationsInWindow
                    .Select(mp => mp.EventId)
                    .Distinct()
                    .Where(eventId => matchLikeEventTypeIds.Contains(matchEventEventTypeById[eventId])
                                      && matchEventDateById[eventId] is { } date && date <= DateTime.UtcNow)
                    .Select(eventId => (EventId: eventId, EventDate: matchEventDateById[eventId]!.Value, EventTypeId: matchEventEventTypeById[eventId]))
                    .ToList();

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

                    var trainingInputs = playerTrainingConvocations
                        .Where(c => trainingEventDateById.TryGetValue(c.SportEventId, out var d) && d is not null && d.Value <= DateTime.UtcNow)
                        .Select(c => new DailyLoadModel.TrainingInput(
                            c.SportEventId,
                            trainingEventDateById[c.SportEventId]!.Value,
                            trainingEventTrainingTypesById.TryGetValue(c.SportEventId, out var types) ? types : new List<string>(),
                            FormStatusOutcome.Classify(c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId),
                            FormStatusOutcome.ReasonFor(c.AssistanceTypeId, c.ExcuseTypeId)))
                        .ToList();

                    var minutesByEvent = playerParticipations
                        .GroupBy(mp => mp.EventId)
                        .ToDictionary(g => g.Key, g => g.Sum(mp => mp.MinutesPlayed));

                    var matchInputs = replayMatches
                        .Where(m => minutesByEvent.ContainsKey(m.EventId)
                                    || (m.EventDate.Date >= player.JoinedDate.Date && (player.LeftDate is null || m.EventDate <= player.LeftDate)))
                        .Select(m =>
                        {
                            minutesByEvent.TryGetValue(m.EventId, out var minutes);
                            return new DailyLoadModel.MatchInput(m.EventId, m.EventDate, m.EventTypeId, minutes, MatchMissedReason(player.Id, m.EventId));
                        })
                        .ToList();

                    var readinessResult = PlayerReadinessCalculator.Calculate(trainingInputs, matchInputs, windowStart, today);

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

                    trainingsAttendedInFatigueWindowByPlayer.TryGetValue(player.Id, out var trainingsInFatigueWindow);
                    trainingsInFatigueWindow ??= new List<(string EventId, DateTime? EventDate, int DaysAgo, IReadOnlyList<string> TrainingTypes)>();
                    matchMinutesInFatigueWindowByPlayer.TryGetValue(player.Id, out var matchesInFatigueWindow);
                    matchesInFatigueWindow ??= new List<(string EventId, DateTime? EventDate, int DaysAgo, int MinutesPlayed, int EventTypeId)>();
                    var fatigueResult = PlayerFatigueCalculator.Calculate(trainingsInFatigueWindow, matchesInFatigueWindow);

                    // Estado de forma: solo para categorías con duración estándar de partido. No
                    // depende de Cansancio. Ver
                    // openspec/changes/player-form-readiness-daily-load-model/design.md → Decisión 6.
                    var formStatusResult = hasStandardMinutes
                        ? PlayerFormStatusCalculator.Calculate(trainingInputs, matchInputs, windowStart, today, standardMinutes)
                        : null;

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

                    var fatigueBreakdown = new FatigueBreakdownDto(
                        fatigueResult.TrainingComponent,
                        fatigueResult.MatchComponent,
                        fatigueResult.DecayedTrainingCount,
                        fatigueResult.DecayedMatchMinutes,
                        PlayerFatigueCalculator.TrainingWeight,
                        PlayerFatigueCalculator.MatchWeight,
                        fatigueResult.ConsideredTrainings
                            .Select(c => new FatigueConsideredTrainingDto(c.EventId, c.EventDate, c.TrainingTypes, c.DaysAgo, c.Decay, c.TypeWeight, c.Contribution))
                            .ToArray(),
                        fatigueResult.ConsideredMatches
                            .Select(c => new FatigueConsideredMatchDto(c.EventId, c.EventDate, c.EventTypeId, c.MinutesPlayed, c.DaysAgo, c.Decay, c.TypeWeight, c.EffectiveMinutes))
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
                        fatigueResult.Fatigue,
                        fatigueBreakdown,
                        readinessResult.Value,
                        ToBreakdown(readinessResult),
                        matchesAbsentAttributableToPlayer,
                        minutesPlayedPercentOfSeasonTotal,
                        attributableAbsentMinutesPercentOfSeasonTotal,
                        formStatusResult?.Value,
                        formStatusResult is null ? null : ToBreakdown(formStatusResult)));
                }

                return result;

                // Motivo informativo de un partido del equipo sin minutos para el jugador.
                string? MatchMissedReason(string teamPlayerId, string eventId)
                {
                    if (!matchLikeConvocationByPlayerEvent.TryGetValue((teamPlayerId, eventId), out var conv))
                        return "No convocado";
                    return FormStatusOutcome.Classify(conv.AssistanceTypeId, conv.ConvocationStatusId, conv.ExcuseTypeId) == ParticipationOutcome.Attended
                        ? "Convocado sin jugar"
                        : FormStatusOutcome.ReasonFor(conv.AssistanceTypeId, conv.ExcuseTypeId);
                }
            }

            private static DailyLoadBreakdownDto? ToBreakdown(DailyLoadModel.MetricResult result) =>
                result.Model is null
                    ? null
                    : new DailyLoadBreakdownDto(
                        result.Model.Value,
                        result.StartDate,
                        DailyLoadModel.ReplayDays,
                        result.Parameters.GainRate,
                        result.Parameters.GraceRestDays,
                        result.Parameters.DecayStepPerDay,
                        result.Parameters.DecayMaxPerDay,
                        DailyLoadModel.MatchLoadPerReferenceMatch,
                        result.ReferenceMatchMinutes,
                        result.Model.CurrentRestStreakDays,
                        result.TrainingsAttended,
                        result.MatchesPlayed,
                        result.MatchMinutesPlayed,
                        result.Model.Steps
                            .Select(s => new DailyLoadStepDto(
                                s.Date, s.EndDate, s.Kind, s.Load, s.ValueBefore, s.ValueAfter,
                                s.Events
                                    .Select(e => new DailyLoadEventDto(e.EventId, e.EventTypeId, e.TrainingTypes, e.MinutesPlayed, e.TypeWeight, e.Load))
                                    .ToArray()))
                            .ToArray(),
                        result.MissedEvents
                            .Select(m => new MissedEventDto(m.EventId, m.Date, m.EventTypeId, m.Reason))
                            .ToArray());

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
