#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Services
{
    public sealed record PlayerCondition(string TeamPlayerId, int Fatigue, int? Readiness, int? FormStatus);

    /// <summary>
    /// Fatigue, readiness and form of a team's players, computed from the replay window the squad
    /// statistics use. <see cref="GetForTeamAsync"/> leaves out players who left the team;
    /// <see cref="GetDetailsAsync"/> keeps them, because the statistics list still returns them.
    /// </summary>
    public sealed class PlayerConditionService(AppDbContext db)
    {
        public async Task<IReadOnlyList<PlayerCondition>> GetForTeamAsync(string teamId, CancellationToken ct)
        {
            var details = await GetDetailsAsync(teamId, ct);
            return details.Values
                .Where(d => d.LeftDate is null)
                .Select(d => new PlayerCondition(d.TeamPlayerId, d.Fatigue.Fatigue, d.Readiness.Value, d.Form?.Value))
                .ToList();
        }

        internal async Task<IReadOnlyDictionary<string, PlayerConditionDetail>> GetDetailsAsync(string teamId, CancellationToken ct)
        {
            var nowUtc = DateTime.UtcNow;
            var today = nowUtc.Date;
            var windowStart = today.AddDays(-(DailyLoadModel.ReplayDays - 1));
            var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
            var matchLikeEventTypeIds = new[]
            {
                SportEventsConstants.MatchEventTypeId,
                SportEventsConstants.FriendlyEventTypeId,
                SportEventsConstants.TournamentEventTypeId
            };

            var players = await db.TeamPlayers
                .AsNoTracking()
                .Where(tp => tp.TeamId == teamId)
                .Select(tp => new { tp.Id, tp.JoinedDate, tp.LeftDate })
                .ToListAsync(ct);

            // Any finished match participation counts in the window (Partido/Amistoso/Torneo): a
            // friendly still costs real physical effort even though season stats leave it out.
            var matchEventsInWindow = await db.SportEvents
                .AsNoTracking()
                .Where(se => se.TeamId == teamId && se.EveDateTime >= windowStart)
                .Select(se => new { se.Id, se.EveDateTime, se.EventTypeId })
                .ToListAsync(ct);
            var matchEventDateById = matchEventsInWindow.ToDictionary(e => e.Id, e => e.EveDateTime);
            var matchEventTypeById = matchEventsInWindow.ToDictionary(e => e.Id, e => e.EventTypeId);
            var matchEventIdsInWindow = matchEventDateById.Keys.ToList();

            // Only window events: PlayerLoadInputsBuilder.Matches reads minutes for window events alone.
            var participationsInWindow = await db.MatchParticipations
                .AsNoTracking()
                .Where(mp => mp.TeamId == teamId && mp.MatchPhase == "finished" && matchEventIdsInWindow.Contains(mp.EventId))
                .Select(mp => new { mp.TeamPlayerId, mp.EventId, mp.MinutesPlayed })
                .ToListAsync(ct);

            var participationRowsInWindowByPlayer = participationsInWindow
                .Where(mp => matchEventDateById[mp.EventId] is not null)
                .GroupBy(mp => mp.TeamPlayerId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(mp => new PlayerLoadInputsBuilder.MatchParticipationRow(
                            mp.EventId, matchEventDateById[mp.EventId]!.Value, matchEventTypeById[mp.EventId], mp.MinutesPlayed))
                        .ToList());

            var minutesByEventByPlayer = participationsInWindow
                .GroupBy(mp => mp.TeamPlayerId)
                .ToDictionary(
                    g => g.Key,
                    g => g.GroupBy(mp => mp.EventId).ToDictionary(e => e.Key, e => e.Sum(mp => mp.MinutesPlayed)));

            var replayMatches = participationsInWindow
                .Select(mp => mp.EventId)
                .Distinct()
                .Where(eventId => matchLikeEventTypeIds.Contains(matchEventTypeById[eventId])
                                  && matchEventDateById[eventId] is { } date && date <= nowUtc)
                .Select(eventId => new PlayerLoadInputsBuilder.TeamMatchRow(eventId, matchEventDateById[eventId]!.Value, matchEventTypeById[eventId]))
                .ToList();

            var trainingEventsInWindow = await db.SportEvents
                .AsNoTracking()
                .Where(se => se.TeamId == teamId && se.EventTypeId == trainingEventTypeId && se.EveDateTime >= windowStart)
                .Select(se => new { se.Id, se.EveDateTime, se.TrainingTypes })
                .ToListAsync(ct);
            var trainingEventDateById = trainingEventsInWindow.ToDictionary(e => e.Id, e => e.EveDateTime);
            var trainingEventTrainingTypesById = trainingEventsInWindow.ToDictionary(e => e.Id, e => e.TrainingTypes);
            var trainingEventIds = trainingEventsInWindow.Select(e => e.Id).ToList();

            var trainingConvocationsInWindow = await db.Convocations
                .AsNoTracking()
                .Where(c => trainingEventIds.Contains(c.SportEventId))
                .Select(c => new { c.TeamPlayerId, c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                .ToListAsync(ct);

            var trainingRowsByPlayer = trainingConvocationsInWindow
                .Where(c => trainingEventDateById.TryGetValue(c.SportEventId, out var d) && d is not null)
                .GroupBy(c => c.TeamPlayerId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(c => new PlayerLoadInputsBuilder.TrainingConvocationRow(
                            c.SportEventId,
                            trainingEventDateById[c.SportEventId]!.Value,
                            trainingEventTrainingTypesById.TryGetValue(c.SportEventId, out var types) ? types : new List<string>(),
                            c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId))
                        .ToList());

            var matchLikeFinishedEventIds = await db.SportEvents
                .AsNoTracking()
                .Where(se => se.TeamId == teamId
                             && se.EveDateTime != null && se.EveDateTime < nowUtc
                             && matchLikeEventTypeIds.Contains(se.EventTypeId))
                .Select(se => se.Id)
                .ToListAsync(ct);

            var matchConvocationsByPlayer = (await db.Convocations
                    .AsNoTracking()
                    .Where(c => matchLikeFinishedEventIds.Contains(c.SportEventId))
                    .Select(c => new { c.TeamPlayerId, c.SportEventId, c.AssistanceTypeId, c.ConvocationStatusId, c.ExcuseTypeId })
                    .ToListAsync(ct))
                .GroupBy(c => c.TeamPlayerId)
                .ToDictionary(
                    g => g.Key,
                    g => (IReadOnlyDictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow>)g
                        .GroupBy(c => c.SportEventId)
                        .ToDictionary(
                            e => e.Key,
                            e => new PlayerLoadInputsBuilder.MatchConvocationRow(
                                e.Key, e.First().AssistanceTypeId, e.First().ConvocationStatusId, e.First().ExcuseTypeId)));

            // Estado de forma exists only for categories with a standard match duration.
            var teamCategoryId = await db.Teams
                .AsNoTracking()
                .Where(t => t.Id == teamId)
                .Select(t => (int?)t.CategoryId)
                .FirstOrDefaultAsync(ct);
            var standardMinutes = 0;
            var hasStandardMinutes = teamCategoryId is { } categoryId
                                     && MatchDurationMinutesByCategory.TryGetMinutes(categoryId, out standardMinutes);

            var details = new Dictionary<string, PlayerConditionDetail>(players.Count);
            foreach (var player in players)
            {
                var playerTrainingRows = trainingRowsByPlayer.TryGetValue(player.Id, out var rows)
                    ? rows
                    : new List<PlayerLoadInputsBuilder.TrainingConvocationRow>();
                var trainingInputs = PlayerLoadInputsBuilder.Trainings(playerTrainingRows, nowUtc);
                var minutesByEvent = minutesByEventByPlayer.TryGetValue(player.Id, out var minutes)
                    ? minutes
                    : new Dictionary<string, int>();
                var matchInputs = PlayerLoadInputsBuilder.Matches(
                    replayMatches,
                    minutesByEvent,
                    matchConvocationsByPlayer.TryGetValue(player.Id, out var convocations)
                        ? convocations
                        : new Dictionary<string, PlayerLoadInputsBuilder.MatchConvocationRow>(),
                    player.JoinedDate,
                    player.LeftDate,
                    nowUtc);

                var readiness = PlayerReadinessCalculator.Calculate(trainingInputs, matchInputs, windowStart, today);
                var fatigue = PlayerFatigueCalculator.Calculate(
                    PlayerLoadInputsBuilder.FatigueTrainings(playerTrainingRows, nowUtc),
                    PlayerLoadInputsBuilder.FatigueMatches(
                        participationRowsInWindowByPlayer.TryGetValue(player.Id, out var matchRows)
                            ? matchRows
                            : new List<PlayerLoadInputsBuilder.MatchParticipationRow>(),
                        nowUtc));
                var form = hasStandardMinutes
                    ? PlayerFormStatusCalculator.Calculate(trainingInputs, matchInputs, windowStart, today, standardMinutes)
                    : null;

                details[player.Id] = new PlayerConditionDetail(player.Id, player.LeftDate, fatigue, readiness, form);
            }

            return details;
        }
    }

    internal sealed record PlayerConditionDetail(
        string TeamPlayerId,
        DateTime? LeftDate,
        PlayerFatigueCalculator.Result Fatigue,
        DailyLoadModel.MetricResult Readiness,
        DailyLoadModel.MetricResult? Form);
}
