using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace RFFM.Api.Features.Mobile.Players.Queries
{
    /// <summary>
    /// Returns a per-player "season card" for every TeamPlayer on a team, aggregating match
    /// participation, discipline (cards), goals and training attendance into a single read-only
    /// response for the Mobile "Cromos" screen.
    ///
    /// All match-derived fields (CurrentMatchday, MatchesPlayed, MatchesStarted,
    /// MatchesSinceLastDeconvocation, Goals) use one consistent definition of "a match": a
    /// finished (MatchParticipation.MatchPhase == "finished") SportEvent of type
    /// SportEventType.Match ("Partido"). Friendlies and other event types are excluded.
    /// </summary>
    public class GetPlayerSeasonCards : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/mobile/teams/{teamId}/season-player-cards",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(
                            new PlayerSeasonCardsQuery { TeamId = teamId },
                            cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetPlayerSeasonCards))
                .WithTags("Mobile")
                .Produces<List<PlayerSeasonCardDto>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record PlayerSeasonCardsQuery : IQueryApp<List<PlayerSeasonCardDto>>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.PlayerSeasonCards;
            public string RequiredPermission => "Read";
        }

        public record PlayerSeasonCardDto(
            string TeamPlayerId,
            string? Alias,
            string? UrlPhoto,
            int? Dorsal,
            int CurrentMatchday,
            int MatchesPlayed,
            int MatchesStarted,
            int MatchesSinceLastDeconvocation,
            int YellowCards,
            int RedCards,
            int Goals,
            int TrainingsAttended,
            int TrainingsAbsent,
            int TrainingsPossible,
            DemarcationDto? ActiveDemarcation,
            DemarcationDto[] PossibleDemarcations);

        public record DemarcationDto(int Id, string Name, string Code);

        private record MatchEventProjection(string Id, DateTime EveDateTime);

        private record TeamPlayerProjection(
            string Id,
            string? Alias,
            string? UrlPhoto,
            int? Dorsal,
            int ActivePositionId,
            List<int>? PossibleDemarcationIds);
        private record DeconvocationProjection(string TeamPlayerId, string SportEventId);
        private record TrainingConvocationProjection(string TeamPlayerId, int? AssistanceTypeId, int? ConvocationStatusId);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<PlayerSeasonCardsQuery, List<PlayerSeasonCardDto>>
        {
            public async ValueTask<List<PlayerSeasonCardDto>> Handle(PlayerSeasonCardsQuery request, CancellationToken cancellationToken)
            {
                var matchEventTypeId = SportEventType.FromName("Partido").Id;
                var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
                var justifiedStatusId = ConvocationStatus.FromName("Justified").Id;
                var deconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

                var teamPlayers = await db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .OrderBy(tp => tp.Player.Name)
                    .ThenBy(tp => tp.Player.LastName)
                    .Select(tp => new TeamPlayerProjection(
                        tp.Id,
                        tp.Player.Alias,
                        tp.Player.UrlPhoto,
                        tp.Dorsal != null ? tp.Dorsal.Number : (int?)null,
                        tp.Demarcation != null ? tp.Demarcation.ActivePositionId : 0,
                        tp.Demarcation != null ? tp.Demarcation.PossibleDemarcationIds : null))
                    .ToListAsync(cancellationToken);

                // All match-type events for the team (any status), used to date-anchor deconvocations.
                var allMatchEvents = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == matchEventTypeId)
                    .Select(se => new MatchEventProjection(se.Id, se.EveDateTime))
                    .ToListAsync(cancellationToken);
                var matchEventDateById = allMatchEvents.ToDictionary(e => e.Id, e => e.EveDateTime);

                var finishedParticipations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
                    .ToListAsync(cancellationToken);

                // Only keep participation rows whose SportEvent is match-type ("Partido").
                var finishedMatchParticipations = finishedParticipations
                    .Where(mp => matchEventDateById.ContainsKey(mp.EventId))
                    .ToList();

                var finishedMatchEventIds = finishedMatchParticipations
                    .Select(mp => mp.EventId)
                    .Distinct()
                    .ToList();

                var currentMatchday = 1 + finishedMatchEventIds.Count;

                var participationsByPlayer = finishedMatchParticipations
                    .GroupBy(mp => mp.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Deconvocations on match-type events, per player: keep the most recent event date.
                var deconvocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => c.ConvocationStatusId == deconvokeStatusId)
                    .Select(c => new DeconvocationProjection(c.TeamPlayerId, c.SportEventId))
                    .ToListAsync(cancellationToken);

                var lastDeconvocationDateByPlayer = deconvocations
                    .Where(d => matchEventDateById.ContainsKey(d.SportEventId))
                    .GroupBy(d => d.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.Max(d => matchEventDateById[d.SportEventId]));

                // Training attendance — mirrors GetTrainingAttendanceSummary's per-player semantics.
                var trainingEventIds = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId && se.EventTypeId == trainingEventTypeId)
                    .Select(se => se.Id)
                    .ToListAsync(cancellationToken);
                var totalTrainingEvents = trainingEventIds.Count;

                var trainingConvocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => trainingEventIds.Contains(c.SportEventId))
                    .Select(c => new TrainingConvocationProjection(c.TeamPlayerId, c.AssistanceTypeId, c.ConvocationStatusId))
                    .ToListAsync(cancellationToken);

                var trainingConvocationsByPlayer = trainingConvocations
                    .GroupBy(c => c.TeamPlayerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var result = new List<PlayerSeasonCardDto>(teamPlayers.Count);
                foreach (var player in teamPlayers)
                {
                    participationsByPlayer.TryGetValue(player.Id, out var playerParticipations);
                    playerParticipations ??= new List<Domain.Entities.TeamPlayers.MatchParticipation>();

                    var matchesPlayed = playerParticipations.Count;
                    var matchesStarted = playerParticipations.Count(mp => mp.IsStarter);
                    var goals = playerParticipations.Sum(mp => CountGoalsForPlayer(mp.GoalsJson, player.Id));
                    var yellowCards = playerParticipations.Sum(mp => CountCards(mp.CardsJson, player.Id, "Yellow"));
                    var redCards = playerParticipations.Sum(mp => CountCards(mp.CardsJson, player.Id, "Red"));

                    int matchesSinceLastDeconvocation;
                    if (lastDeconvocationDateByPlayer.TryGetValue(player.Id, out var lastDeconvocationDate))
                    {
                        matchesSinceLastDeconvocation = finishedMatchEventIds
                            .Count(eventId => matchEventDateById[eventId] > lastDeconvocationDate);
                    }
                    else
                    {
                        matchesSinceLastDeconvocation = matchesPlayed;
                    }

                    trainingConvocationsByPlayer.TryGetValue(player.Id, out var playerTrainingConvocations);
                    playerTrainingConvocations ??= new List<TrainingConvocationProjection>();

                    var trainingsAttended = playerTrainingConvocations.Count(c =>
                        c.AssistanceTypeId == AssistanceType.Attendance.Id || c.AssistanceTypeId == AssistanceType.LateArrival.Id);

                    var trainingsAbsent = playerTrainingConvocations.Count(c =>
                        c.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id ||
                        c.AssistanceTypeId == AssistanceType.UnexcusedAbsence.Id ||
                        (c.AssistanceTypeId == null && (c.ConvocationStatusId == justifiedStatusId || c.ConvocationStatusId == deconvokeStatusId)));

                    DemarcationDto? activeDemarcation = null;
                    if (player.ActivePositionId != 0)
                    {
                        var activeMaster = DemarcationMaster.GetById(player.ActivePositionId);
                        activeDemarcation = new DemarcationDto(activeMaster.Id, activeMaster.Name, activeMaster.Code);
                    }

                    var possibleDemarcations = (player.PossibleDemarcationIds ?? new List<int>())
                        .Select(DemarcationMaster.GetById)
                        .Select(m => new DemarcationDto(m.Id, m.Name, m.Code))
                        .ToArray();

                    result.Add(new PlayerSeasonCardDto(
                        player.Id,
                        player.Alias,
                        player.UrlPhoto,
                        player.Dorsal,
                        currentMatchday,
                        matchesPlayed,
                        matchesStarted,
                        matchesSinceLastDeconvocation,
                        yellowCards,
                        redCards,
                        goals,
                        trainingsAttended,
                        trainingsAbsent,
                        totalTrainingEvents,
                        activeDemarcation,
                        possibleDemarcations));
                }

                return result;
            }

            /// <summary>
            /// Parses GoalsJson to count goals where scorerId == teamPlayerId and isOwnTeam == true.
            /// Same logic as GetSeasonPlayerStats.CountGoalsForPlayer. Returns 0 for null/malformed JSON.
            /// </summary>
            private static int CountGoalsForPlayer(string? goalsJson, string teamPlayerId)
            {
                if (string.IsNullOrEmpty(goalsJson)) return 0;

                try
                {
                    using var doc = JsonDocument.Parse(goalsJson);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                    int count = 0;
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

            /// <summary>
            /// Parses CardsJson (array of CardEvent { teamPlayerId, cardType }) and counts cards of the
            /// given type attributed to teamPlayerId. Returns 0 for null/malformed JSON.
            /// </summary>
            private static int CountCards(string? cardsJson, string teamPlayerId, string cardType)
            {
                if (string.IsNullOrEmpty(cardsJson)) return 0;

                try
                {
                    using var doc = JsonDocument.Parse(cardsJson);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                    int count = 0;
                    foreach (var card in doc.RootElement.EnumerateArray())
                    {
                        var cardTeamPlayerId = card.TryGetProperty("teamPlayerId", out var idProp) ? idProp.GetString() : null;
                        var cardTypeValue = card.TryGetProperty("cardType", out var typeProp) ? typeProp.GetString() : null;

                        if (cardTeamPlayerId == teamPlayerId &&
                            string.Equals(cardTypeValue, cardType, StringComparison.OrdinalIgnoreCase))
                        {
                            count++;
                        }
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
