using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns, per player on a team, season totals (goals/cards/minutes) plus a windowed
    /// "Estado de forma" (0-100) built from recent training attendance and match minutes.
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

        public record PlayerStatisticsDto(
            string TeamPlayerId,
            string DisplayName,
            string? Position,
            int? Dorsal,
            int Goals,
            int YellowCards,
            int RedCards,
            int MinutesPlayed,
            int TrainingsAttended,                  // histórico completo de temporada
            int MatchesPlayed,                      // histórico completo de temporada
            int? DaysSinceLastInjury,               // null si no ha tenido ninguna lesión esta temporada
            int? LastInjuryDurationDays,             // null si no ha tenido lesión, o si la más reciente sigue en curso
            int? FormStatus,                       // 0-100, null = sin datos suficientes en la ventana
            FormStatusBreakdownDto? FormStatusBreakdown);

        public record FormStatusBreakdownDto(
            double TrainingComponent,              // 0-100
            double MatchComponent,                 // 0-100
            int TrainingSessionsConsidered,
            int TrainingSessionsBaseline,          // = PlayerFormStatusCalculator.BaselineTrainings
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
            int ActivePositionId);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<Query, List<PlayerStatisticsDto>>
        {
            public async ValueTask<List<PlayerStatisticsDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var windowStart = DateTime.UtcNow.AddDays(-7 * PlayerFormStatusCalculator.WindowWeeks);
                var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
                var matchEventTypeId = SportEventType.FromName("Partido").Id;

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
                        tp.Demarcation != null ? tp.Demarcation.ActivePositionId : 0))
                    .ToListAsync(cancellationToken);

                // Season totals (goals/cards/minutes) — same as GetSeasonPlayerStats / GetPlayerSeasonCards.
                var finishedParticipations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
                    .ToListAsync(cancellationToken);

                var participationsByPlayer = finishedParticipations
                    .GroupBy(mp => mp.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // 8-week window for the match component of the form status.
                var matchEventIdsInWindow = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == matchEventTypeId
                                 && se.EveDateTime >= windowStart)
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

                // Season totals (full history, not windowed) — same as GetPlayerSeasonCards.TrainingsAttended.
                var allTrainingEventIds = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == trainingEventTypeId)
                    .Select(se => se.Id)
                    .ToListAsync(cancellationToken);

                var allTrainingConvocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => allTrainingEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.TeamPlayerId, c.AssistanceTypeId })
                    .ToListAsync(cancellationToken);

                var trainingsAttendedByPlayer = allTrainingConvocations
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.Count(c =>
                        c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id));

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
                        .Select(c => new PlayerFormStatusCalculator.TrainingOutcome(
                            c.SportEventId,
                            trainingEventDateById.TryGetValue(c.SportEventId, out var date) ? date : null,
                            c.AssistanceTypeId,
                            c.ExcuseTypeId,
                            c.ConvocationStatusId))
                        .ToList();

                    matchMinutesInWindowByPlayer.TryGetValue(player.Id, out var matchMinutesInWindow);
                    matchMinutesInWindow ??= new List<int>();

                    var formResult = PlayerFormStatusCalculator.Calculate(trainingOutcomes, matchMinutesInWindow);

                    trainingsAttendedByPlayer.TryGetValue(player.Id, out var trainingsAttended);
                    var matchesPlayed = playerParticipations.Count;

                    int? daysSinceLastInjury = null;
                    int? lastInjuryDurationDays = null;
                    if (mostRecentInjuryByPlayer.TryGetValue(player.Id, out var lastInjury))
                    {
                        daysSinceLastInjury = (int)(DateTime.UtcNow - lastInjury.StartDate).TotalDays;
                        lastInjuryDurationDays = lastInjury.EndDate.HasValue
                            ? (int)(lastInjury.EndDate.Value - lastInjury.StartDate).TotalDays
                            : null;
                    }

                    string? position = player.ActivePositionId != 0
                        ? DemarcationMaster.GetById(player.ActivePositionId)?.Name
                        : null;

                    var displayName = !string.IsNullOrWhiteSpace(player.Alias)
                        ? player.Alias
                        : string.Join(" ", new[] { player.Name, player.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim();

                    var formStatusBreakdown = new FormStatusBreakdownDto(
                        formResult.TrainingComponent,
                        formResult.MatchComponent,
                        formResult.SessionsConsidered,
                        PlayerFormStatusCalculator.BaselineTrainings,
                        formResult.MatchMinutesInWindow,
                        PlayerFormStatusCalculator.BaselineMatches * PlayerFormStatusCalculator.ExpectedMinutesPerMatch,
                        formResult.RecentAbsences
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
                        trainingsAttended,
                        matchesPlayed,
                        daysSinceLastInjury,
                        lastInjuryDurationDays,
                        formResult.FormStatus,
                        formStatusBreakdown));
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
