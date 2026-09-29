using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public interface IRffmResultsSyncService
    {
        Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId,
            CancellationToken cancellationToken);

        Task<CalendarResponse> GetCalendarAsync(int groupId, int seasonId, CancellationToken cancellationToken);

        Task<ClassificationResponse> GetClassificationAsync(int groupId, int seasonId, CancellationToken cancellationToken);

        Task RecomputeStandingsAsync(string groupCode, CancellationToken cancellationToken);

        Task ReconcileStandingsAsync(string groupCode, int round, IReadOnlyList<TeamResponse> official,
            CancellationToken cancellationToken);
    }

    /// <summary>
    /// Sirve jornadas, calendario y clasificación desde la base de datos (compartidos entre usuarios) y solo
    /// pide a la RFFM las jornadas que no están guardadas o a las que les faltan datos
    /// (<see cref="RffmRoundRefreshPolicy"/>). La clasificación se calcula con <see cref="RffmStandingsCalculator"/>
    /// cada vez que cambia algún partido y se concilia con la oficial al cerrarse cada jornada.
    /// </summary>
    public class RffmResultsSyncService(
        FederationDbContext db,
        IRffmResultsClient client,
        IRffmResultsJobQueue jobQueue,
        IKeyedLock keyedLock,
        TimeProvider timeProvider,
        IOptions<RffmOptions> options,
        ICompetitionService competitionService,
        ILogger<RffmResultsSyncService> logger) : IRffmResultsSyncService
    {
        private static readonly TimeZoneInfo Madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");
        private const int MaxParallelRoundRequests = 4;

        private sealed class GroupState(RffmCompetitionGroup? group, List<RffmRound> rounds)
        {
            public RffmCompetitionGroup? Group { get; set; } = group;
            public List<RffmRound> Rounds { get; } = rounds;
        }

        public async Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId,
            CancellationToken cancellationToken)
        {
            var state = await SyncAsync(groupId.ToString(), seasonId, round, cancellationToken);
            return state.Group == null
                ? new CalendarMatchDayWithRoundsResponse { Round = round, GroupId = groupId }
                : RffmMatchDayMapper.ToResponse(groupId, round, state.Group, state.Rounds);
        }

        public async Task<CalendarResponse> GetCalendarAsync(int groupId, int seasonId, CancellationToken cancellationToken)
        {
            var state = await SyncAsync(groupId.ToString(), seasonId, onlyRound: null, cancellationToken);
            return state.Group == null
                ? new CalendarResponse()
                : RffmMatchDayMapper.ToCalendarResponse(state.Group, state.Rounds);
        }

        public async Task<ClassificationResponse> GetClassificationAsync(int groupId, int seasonId, CancellationToken cancellationToken)
        {
            var state = await SyncAsync(groupId.ToString(), seasonId, onlyRound: null, cancellationToken);
            var canUseComputed = state.Group?.StandingsJson != null && !HasPendingPastRounds(state);
            if (canUseComputed)
                return new ClassificationResponse { Teams = RffmStandingsMapper.Parse(state.Group!.StandingsJson) };

            logger.LogWarning("Calendario incompleto del grupo {GroupId}: se devuelve la clasificación oficial de la RFFM", groupId);
            return await competitionService.GetClassification(groupId, cancellationToken);
        }

        public async Task RecomputeStandingsAsync(string groupCode, CancellationToken cancellationToken)
        {
            using (await keyedLock.AcquireAsync(groupCode, cancellationToken))
            {
                var state = await LoadAsync(groupCode, tracking: true, cancellationToken);
                if (state.Group != null)
                    await RecomputeAsync(state, cancellationToken);
                db.ChangeTracker.Clear();
            }
        }

        public async Task ReconcileStandingsAsync(string groupCode, int round, IReadOnlyList<TeamResponse> official,
            CancellationToken cancellationToken)
        {
            using (await keyedLock.AcquireAsync(groupCode, cancellationToken))
            {
                var state = await LoadAsync(groupCode, tracking: true, cancellationToken);
                var group = state.Group;
                if (group == null)
                    return;

                var officialJson = RffmMatchDayMapper.SerializeStandings(official);
                var isLatestOfficial = round >= (group.OfficialStandingsRound ?? 0);
                if (isLatestOfficial)
                    group.UpdateOfficialStandings(officialJson, round);
                await db.SaveChangesAsync(cancellationToken);
                await RecomputeAsync(state, cancellationToken);

                var now = timeProvider.GetUtcNow().UtcDateTime;
                var snapshot = await db.RffmStandingsSnapshots
                    .SingleOrDefaultAsync(s => s.GroupCode == groupCode && s.Round == round, cancellationToken);
                if (snapshot == null)
                {
                    db.RffmStandingsSnapshots.Add(RffmStandingsSnapshot.Create(groupCode, round, officialJson, StandingsSource.Official, now));
                }
                else
                {
                    var computed = RffmStandingsMapper.Parse(snapshot.PayloadJson);
                    var sameStats = RffmStandingsMapper.HaveSameStats(official, computed);
                    var sameOrder = computed.Select(t => t.TeamId).SequenceEqual(official.Select(t => t.TeamId?.Trim()));
                    if (!sameStats)
                    {
                        logger.LogWarning("La clasificación oficial de la jornada {Round} del grupo {GroupCode} tiene datos distintos a la calculada; se mantiene la calculada",
                            round, groupCode);
                    }
                    else if (!sameOrder)
                    {
                        logger.LogWarning("Orden distinto en la jornada {Round} del grupo {GroupCode}. Calculado: {Computed}. Oficial: {Official}. Se usa el oficial",
                            round, groupCode, string.Join(",", computed.Select(t => t.TeamId)), string.Join(",", official.Select(t => t.TeamId)));
                        snapshot.Replace(officialJson, StandingsSource.Official, now);
                        if (group.StandingsRound == round)
                            group.UpdateStandings(officialJson, round, now);
                    }
                }

                await db.SaveChangesAsync(cancellationToken);
                db.ChangeTracker.Clear();
            }
        }

        private async Task<GroupState> SyncAsync(string groupCode, int seasonId, int? onlyRound, CancellationToken cancellationToken)
        {
            var stored = await LoadAsync(groupCode, tracking: false, cancellationToken);
            if (NextRoundToFetch(stored, onlyRound, new HashSet<int>()) == null && !NeedsStandings(stored))
                return stored;

            using (await keyedLock.AcquireAsync(groupCode, cancellationToken))
            {
                var state = await LoadAsync(groupCode, tracking: true, cancellationToken);
                var jobs = new List<RffmResultsJob>();
                var changed = false;
                var attempted = new HashSet<int>();
                var prefetched = new Dictionary<int, Task<CalendarRffm?>>();
                using var gate = new SemaphoreSlim(MaxParallelRoundRequests);

                while (NextRoundToFetch(state, onlyRound, attempted) is { } round)
                {
                    attempted.Add(round);
                    if (state.Group != null)
                    {
                        // Las jornadas pendientes se piden en paralelo (limitado) y se aplican en orden.
                        foreach (var pending in PendingRounds(state, onlyRound, attempted).Prepend(round).Where(r => !prefetched.ContainsKey(r)))
                            prefetched[pending] = FetchGatedAsync(groupCode, pending, gate, cancellationToken);
                    }

                    try
                    {
                        var calendar = await (prefetched.GetValueOrDefault(round) ?? client.GetRoundAsync(groupCode, round, cancellationToken));
                        changed |= await ApplyRoundAsync(state, groupCode, round, seasonId, calendar, jobs, cancellationToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
                    {
                        logger.LogWarning(ex, "No se pudo actualizar la jornada {Round} del grupo {GroupCode} desde la RFFM; se sirven los datos guardados",
                            round, groupCode);
                        db.ChangeTracker.Clear();
                        state = await LoadAsync(groupCode, tracking: true, cancellationToken);
                        if (state.Group == null)
                            break;
                    }
                }

                // Ninguna petición adelantada sigue viva tras liberar el semáforo; sus errores ya se trataron al aplicarlas.
                await Task.WhenAll(prefetched.Values.Select(t => t.ContinueWith(_ => { }, TaskScheduler.Default)));

                if (state.Group != null && (changed || NeedsStandings(state)))
                {
                    try
                    {
                        await RecomputeAsync(state, cancellationToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
                    {
                        logger.LogError(ex, "No se pudo recalcular la clasificación del grupo {GroupCode}", groupCode);
                    }
                }

                foreach (var job in jobs.Distinct())
                    await jobQueue.EnqueueAsync(job, cancellationToken);

                db.ChangeTracker.Clear();
            }

            return await LoadAsync(groupCode, tracking: false, cancellationToken);
        }

        private int? NextRoundToFetch(GroupState state, int? onlyRound, IReadOnlySet<int> attempted)
        {
            if (state.Group == null)
            {
                var first = onlyRound ?? 1;
                return attempted.Contains(first) ? null : first;
            }

            return PendingRounds(state, onlyRound, attempted).Cast<int?>().FirstOrDefault();
        }

        private IEnumerable<int> PendingRounds(GroupState state, int? onlyRound, IReadOnlySet<int> attempted)
        {
            var candidates = onlyRound is { } only ? [only] : state.Rounds.Select(r => r.Number);
            foreach (var number in candidates.Where(n => !attempted.Contains(n)).Distinct().OrderBy(n => n))
            {
                var round = state.Rounds.FirstOrDefault(r => r.Number == number);
                if (round == null || Evaluate(state.Group!, round) != RoundRefreshReason.None)
                    yield return number;
            }
        }

        private async Task<CalendarRffm?> FetchGatedAsync(string groupCode, int round, SemaphoreSlim gate, CancellationToken cancellationToken)
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                return await client.GetRoundAsync(groupCode, round, cancellationToken);
            }
            finally
            {
                gate.Release();
            }
        }

        private RoundRefreshReason Evaluate(RffmCompetitionGroup group, RffmRound round) =>
            RffmRoundRefreshPolicy.Evaluate(round, group.MatchMinutes, group.MatchParts,
                timeProvider.GetUtcNow().UtcDateTime, options.Value.Results);

        private static bool NeedsStandings(GroupState state) => state.Group is { StandingsRound: null };

        private bool HasPendingPastRounds(GroupState state)
        {
            var today = TodayInMadrid();
            return state.Rounds.Any(r => r.LastSyncedAt == null && r.Date is { } date && date <= today);
        }

        private async Task<bool> ApplyRoundAsync(GroupState state, string groupCode, int round, int seasonId,
            CalendarRffm? calendar, List<RffmResultsJob> jobs, CancellationToken cancellationToken)
        {
            if (calendar == null)
                throw new InvalidOperationException("La RFFM no ha devuelto la jornada.");
            var now = timeProvider.GetUtcNow().UtcDateTime;

            var isNewGroup = state.Group == null;
            var group = state.Group ?? await CreateGroupAsync(groupCode, seasonId, calendar, now, cancellationToken);
            state.Group = group;

            foreach (var info in RffmMatchDayMapper.ToRoundInfos(calendar))
            {
                var existing = state.Rounds.FirstOrDefault(r => r.Number == info.Number);
                if (existing != null)
                {
                    existing.UpdateInfo(info.Name, info.Date);
                    continue;
                }

                var created = RffmRound.Create(groupCode, info.Number, info.Name, info.Date);
                db.RffmRounds.Add(created);
                state.Rounds.Add(created);
            }

            var target = state.Rounds.FirstOrDefault(r => r.Number == round);
            if (target == null)
            {
                target = RffmRound.Create(groupCode, round, round.ToString(), null);
                db.RffmRounds.Add(target);
                state.Rounds.Add(target);
            }

            var result = target.ApplySnapshot(RffmMatchDayMapper.ToSnapshots(calendar), now);
            await db.SaveChangesAsync(cancellationToken);

            jobs.AddRange(result.NewlyFinalRecordCodes.Select(code =>
                new FetchMatchRecordJob(code, group.SeasonId, group.CompetitionCode, groupCode)));

            var roundClosed = result.NewlyFinalRecordCodes.Count > 0 && target.Matches.All(m => m.IsFinal);
            if (isNewGroup)
                jobs.Add(new ReconcileStandingsJob(groupCode, LatestPlayedRound(state.Rounds, round)));
            else if (roundClosed)
                jobs.Add(new ReconcileStandingsJob(groupCode, target.Number));

            return result.Changed || isNewGroup;
        }

        private async Task<RffmCompetitionGroup> CreateGroupAsync(string groupCode, int seasonId, CalendarRffm calendar,
            DateTime now, CancellationToken cancellationToken)
        {
            RffmCompetitionInfo? competition = null;
            try
            {
                var seasons = new[] { seasonId }.Concat(options.Value.SelectableSeasons.Select(s => s.Id)).ToList();
                competition = await client.FindCompetitionAsync(calendar.CompetitionCode, seasons, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "No se pudo obtener la competición {CompetitionCode}; se usan la duración y los puntos por defecto",
                    calendar.CompetitionCode);
            }

            var group = RffmCompetitionGroup.Create(groupCode, competition?.SeasonId ?? seasonId, calendar.CompetitionCode,
                calendar.CompetitionName, calendar.GroupName, competition?.Minutes, competition?.Parts, competition?.Points, now);
            db.RffmCompetitionGroups.Add(group);
            return group;
        }

        /// <summary>
        /// Recalcula la clasificación vigente y la de cada jornada. Si faltan jornadas pasadas por descargar no
        /// se calcula con datos parciales: se usa la última clasificación oficial conciliada.
        /// </summary>
        private async Task RecomputeAsync(GroupState state, CancellationToken cancellationToken)
        {
            var group = state.Group!;
            var now = timeProvider.GetUtcNow().UtcDateTime;
            var official = RffmStandingsMapper.Parse(group.OfficialStandingsJson);

            if (HasPendingPastRounds(state))
            {
                if (group.OfficialStandingsJson != null)
                    group.UpdateStandings(group.OfficialStandingsJson, null, now);
                await db.SaveChangesAsync(cancellationToken);
                return;
            }

            var matches = state.Rounds
                .SelectMany(r => r.Matches.Select(m => (Round: r.Number, Match: m)))
                .ToList();
            var calendar = matches
                .Select(x => new StandingsMatch(x.Round, x.Match.LocalTeamCode, x.Match.VisitorTeamCode,
                    ParseGoals(x.Match.LocalGoals), ParseGoals(x.Match.VisitorGoals)))
                .ToList();
            var teams = matches
                .OrderByDescending(x => x.Round)
                .SelectMany(x => new[]
                {
                    new StandingsTeam(x.Match.LocalTeamCode, x.Match.LocalTeamName, x.Match.LocalTeamImageUrl),
                    new StandingsTeam(x.Match.VisitorTeamCode, x.Match.VisitorTeamName, x.Match.VisitorTeamImageUrl)
                })
                .Where(t => !string.IsNullOrWhiteSpace(t.Code))
                .GroupBy(t => t.Code)
                .Select(g => g.First())
                .ToList();
            var sanctions = RffmStandingsMapper.Sanctions(official);
            var lastRound = calendar.Where(m => m.HasResult).Select(m => m.Round).DefaultIfEmpty(0).Max();

            var snapshots = await db.RffmStandingsSnapshots
                .Where(s => s.GroupCode == group.GroupCode)
                .ToListAsync(cancellationToken);

            string Compute(int upToRound) => RffmMatchDayMapper.SerializeStandings(RffmStandingsMapper.ToTeamResponses(
                RffmStandingsCalculator.Calculate(teams, calendar, upToRound, group.Points, sanctions), official));

            var current = Compute(lastRound);
            foreach (var number in state.Rounds.Select(r => r.Number).Where(n => n <= lastRound).Distinct().OrderBy(n => n))
            {
                var json = number == lastRound ? current : Compute(number);
                var existing = snapshots.FirstOrDefault(s => s.Round == number);
                var keepOfficial = existing?.Source == StandingsSource.Official &&
                                   RffmStandingsMapper.HaveSameStats(RffmStandingsMapper.Parse(existing.PayloadJson),
                                       RffmStandingsMapper.Parse(json));
                if (keepOfficial)
                {
                    if (number == lastRound) current = existing!.PayloadJson;
                    continue;
                }

                if (existing == null)
                    db.RffmStandingsSnapshots.Add(RffmStandingsSnapshot.Create(group.GroupCode, number, json, StandingsSource.Computed, now));
                else
                    existing.Replace(json, StandingsSource.Computed, now);
            }

            group.UpdateStandings(current, lastRound, now);
            await db.SaveChangesAsync(cancellationToken);
        }

        private static int? ParseGoals(string value) => int.TryParse(value, out var goals) ? goals : null;

        /// <summary>Última jornada cuya fecha ya ha llegado: es la que da la clasificación vigente.</summary>
        private int LatestPlayedRound(IEnumerable<RffmRound> rounds, int fallback)
        {
            var today = TodayInMadrid();
            var played = rounds.Where(r => r.Date is { } date && date <= today).Select(r => r.Number).ToList();
            return played.Count > 0 ? played.Max() : fallback;
        }

        private DateOnly TodayInMadrid() =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(timeProvider.GetUtcNow().UtcDateTime, Madrid));

        private async Task<GroupState> LoadAsync(string groupCode, bool tracking, CancellationToken cancellationToken)
        {
            var groups = tracking ? db.RffmCompetitionGroups : db.RffmCompetitionGroups.AsNoTracking();
            var rounds = tracking ? db.RffmRounds : db.RffmRounds.AsNoTracking();

            var group = await groups.SingleOrDefaultAsync(g => g.GroupCode == groupCode, cancellationToken);
            var roundList = await rounds
                .Include(r => r.Matches)
                .Where(r => r.GroupCode == groupCode)
                .ToListAsync(cancellationToken);

            return new GroupState(group, roundList);
        }
    }
}
