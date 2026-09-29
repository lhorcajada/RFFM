using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public interface IRffmResultsSyncService
    {
        Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId,
            CancellationToken cancellationToken);
    }

    /// <summary>
    /// Sirve las jornadas desde la base de datos (compartidas entre usuarios) y solo pide la jornada a la
    /// RFFM cuando no está guardada o le faltan datos (ver <see cref="RffmRoundRefreshPolicy"/>).
    /// Las actas y la clasificación se descargan en segundo plano.
    /// </summary>
    public class RffmResultsSyncService(
        FederationDbContext db,
        IRffmResultsClient client,
        IRffmResultsJobQueue jobQueue,
        IKeyedLock keyedLock,
        TimeProvider timeProvider,
        IOptions<RffmOptions> options,
        ILogger<RffmResultsSyncService> logger) : IRffmResultsSyncService
    {
        private static readonly TimeZoneInfo Madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        private sealed record Snapshot(RffmCompetitionGroup? Group, List<RffmRound> Rounds, RffmRound? Target);

        public async Task<CalendarMatchDayWithRoundsResponse> GetMatchDayAsync(int groupId, int round, int seasonId,
            CancellationToken cancellationToken)
        {
            var groupCode = groupId.ToString();
            var stored = await LoadAsync(groupCode, round, tracking: false, cancellationToken);
            if (!NeedsRefresh(stored))
                return ToResponse(groupId, round, stored);

            using (await keyedLock.AcquireAsync(groupCode, cancellationToken))
            {
                stored = await LoadAsync(groupCode, round, tracking: true, cancellationToken);
                if (!NeedsRefresh(stored))
                    return ToResponse(groupId, round, stored);

                try
                {
                    var jobs = await RefreshAsync(groupCode, round, seasonId, stored, cancellationToken);
                    foreach (var job in jobs)
                        await jobQueue.EnqueueAsync(job, cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
                {
                    logger.LogWarning(ex, "No se pudo actualizar la jornada {Round} del grupo {GroupCode} desde la RFFM; se sirven los datos guardados",
                        round, groupCode);
                }

                db.ChangeTracker.Clear();
            }

            return ToResponse(groupId, round, await LoadAsync(groupCode, round, tracking: false, cancellationToken));
        }

        private bool NeedsRefresh(Snapshot stored)
        {
            if (stored.Group == null || stored.Target == null)
                return true;

            var reason = RffmRoundRefreshPolicy.Evaluate(stored.Target, stored.Group.MatchMinutes, stored.Group.MatchParts,
                timeProvider.GetUtcNow().UtcDateTime, options.Value.Results);
            return reason != RoundRefreshReason.None;
        }

        private async Task<IReadOnlyList<RffmResultsJob>> RefreshAsync(string groupCode, int round, int seasonId, Snapshot stored,
            CancellationToken cancellationToken)
        {
            var calendar = await client.GetRoundAsync(groupCode, round, cancellationToken)
                           ?? throw new InvalidOperationException("La RFFM no ha devuelto la jornada.");
            var now = timeProvider.GetUtcNow().UtcDateTime;

            var group = stored.Group ?? await CreateGroupAsync(groupCode, seasonId, calendar, now, cancellationToken);
            var rounds = stored.Rounds;

            foreach (var info in RffmMatchDayMapper.ToRoundInfos(calendar))
            {
                var existing = rounds.FirstOrDefault(r => r.Number == info.Number);
                if (existing != null)
                {
                    existing.UpdateInfo(info.Name, info.Date);
                    continue;
                }

                var created = RffmRound.Create(groupCode, info.Number, info.Name, info.Date);
                db.RffmRounds.Add(created);
                rounds.Add(created);
            }

            var target = rounds.FirstOrDefault(r => r.Number == round);
            if (target == null)
            {
                target = RffmRound.Create(groupCode, round, round.ToString(), null);
                db.RffmRounds.Add(target);
                rounds.Add(target);
            }

            var result = target.ApplySnapshot(RffmMatchDayMapper.ToSnapshots(calendar), now);
            await db.SaveChangesAsync(cancellationToken);

            var jobs = result.NewlyFinalRecordCodes
                .Select(code => (RffmResultsJob)new FetchMatchRecordJob(code, group.SeasonId, group.CompetitionCode, groupCode))
                .ToList();
            var standingsOutdated = result.NewlyFinalRecordCodes.Count > 0 || group.StandingsJson == null;
            if (standingsOutdated)
                jobs.Add(new RefreshStandingsJob(groupCode, LatestPlayedRound(rounds, round, now)));

            return jobs;
        }

        private async Task<RffmCompetitionGroup> CreateGroupAsync(string groupCode, int seasonId, CalendarRffm calendar,
            DateTime now, CancellationToken cancellationToken)
        {
            RffmCompetitionDuration? duration = null;
            try
            {
                duration = await client.GetCompetitionDurationAsync(seasonId, calendar.CompetitionCode, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "No se pudo obtener la duración de la competición {CompetitionCode}; se usa la duración por defecto",
                    calendar.CompetitionCode);
            }

            var group = RffmCompetitionGroup.Create(groupCode, seasonId, calendar.CompetitionCode, calendar.CompetitionName,
                calendar.GroupName, duration?.Minutes, duration?.Parts, now);
            db.RffmCompetitionGroups.Add(group);
            return group;
        }

        /// <summary>Última jornada cuya fecha ya ha llegado: es la que da la clasificación vigente.</summary>
        private static int LatestPlayedRound(IEnumerable<RffmRound> rounds, int fallback, DateTime nowUtc)
        {
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(nowUtc, Madrid));
            var played = rounds.Where(r => r.Date is { } date && date <= today).Select(r => r.Number).ToList();
            return played.Count > 0 ? played.Max() : fallback;
        }

        private async Task<Snapshot> LoadAsync(string groupCode, int round, bool tracking, CancellationToken cancellationToken)
        {
            var groups = tracking ? db.RffmCompetitionGroups : db.RffmCompetitionGroups.AsNoTracking();
            var roundsQuery = tracking ? db.RffmRounds : db.RffmRounds.AsNoTracking();

            var group = await groups.SingleOrDefaultAsync(g => g.GroupCode == groupCode, cancellationToken);
            var rounds = await roundsQuery.Where(r => r.GroupCode == groupCode).ToListAsync(cancellationToken);
            var target = await roundsQuery
                .Include(r => r.Matches)
                .SingleOrDefaultAsync(r => r.GroupCode == groupCode && r.Number == round, cancellationToken);

            if (target != null)
                rounds = rounds.Select(r => r.Number == round ? target : r).ToList();

            return new Snapshot(group, rounds, target);
        }

        private static CalendarMatchDayWithRoundsResponse ToResponse(int groupId, int round, Snapshot stored) =>
            stored.Group == null
                ? new CalendarMatchDayWithRoundsResponse { Round = round, GroupId = groupId }
                : RffmMatchDayMapper.ToResponse(groupId, round, stored.Group, stored.Rounds);
    }
}
