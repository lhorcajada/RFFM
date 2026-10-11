using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Federation.LeagueSquadStats.Services
{
    /// <summary>Ejecución semanal a una hora local de Europe/Madrid (p. ej. lunes 00:01).</summary>
    public sealed record WeeklySchedule(DayOfWeek Day, TimeOnly Time)
    {
        private const string TimeZoneId = "Europe/Madrid";
        private static readonly TimeOnly DefaultTime = new(0, 1);
        private static readonly TimeZoneInfo TimeZone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

        public static WeeklySchedule From(DayOfWeek day, string? time) =>
            new(day, TimeOnly.TryParseExact(time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
                ? parsed
                : DefaultTime);

        /// <summary>Primera ejecución estrictamente posterior a <paramref name="now"/>.</summary>
        public DateTimeOffset NextRun(DateTimeOffset now)
        {
            var run = RunOfWeekContaining(now);
            return run > now ? run : RunOnLocalDate(LocalDate(run).AddDays(7));
        }

        /// <summary>Última ejecución anterior o igual a <paramref name="now"/>.</summary>
        public DateTimeOffset LastRun(DateTimeOffset now)
        {
            var run = RunOfWeekContaining(now);
            return run <= now ? run : RunOnLocalDate(LocalDate(run).AddDays(-7));
        }

        private DateTimeOffset RunOfWeekContaining(DateTimeOffset now)
        {
            var today = LocalDate(now);
            var daysUntilRunDay = ((int)Day - (int)today.DayOfWeek + 7) % 7;
            return RunOnLocalDate(today.AddDays(daysUntilRunDay));
        }

        private DateTimeOffset RunOnLocalDate(DateOnly date)
        {
            var local = date.ToDateTime(Time, DateTimeKind.Unspecified);
            return new DateTimeOffset(local, TimeZone.GetUtcOffset(local)).ToUniversalTime();
        }

        private static DateOnly LocalDate(DateTimeOffset instant) =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, TimeZone).DateTime);
    }

    public interface ILeagueSquadStatsScheduleService
    {
        /// <summary>
        /// Encola la actualización de las ligas de los equipos de Coach cuya última petición es anterior a
        /// <paramref name="dueBeforeUtc"/>, creando el informe de las que aún no lo tienen.
        /// </summary>
        Task<int> EnqueueDueAsync(DateTime dueBeforeUtc, CancellationToken cancellationToken);
    }

    public class LeagueSquadStatsScheduleService(
        AppDbContext appDb,
        FederationDbContext db,
        ILeagueSquadStatsQueue queue,
        IOptions<RffmOptions> rffmOptions,
        TimeProvider timeProvider) : ILeagueSquadStatsScheduleService
    {
        public async Task<int> EnqueueDueAsync(DateTime dueBeforeUtc, CancellationToken cancellationToken)
        {
            var seasonId = rffmOptions.Value.CurrentSeasonId;
            var previousSeasonId = RffmSeasons.Previous(rffmOptions.Value, seasonId);
            var now = timeProvider.GetUtcNow().UtcDateTime;

            var coachLeagues = await appDb.Teams
                .AsNoTracking()
                .Where(t => t.RffmCompetitionId != null && t.RffmGroupId != null)
                .Select(t => new { CompetitionId = t.RffmCompetitionId!.Value, GroupId = t.RffmGroupId!.Value })
                .Distinct()
                .ToListAsync(cancellationToken);

            var reports = await db.LeagueSquadStatsReports
                .Where(r => r.SeasonId == seasonId)
                .ToListAsync(cancellationToken);
            var reportsByLeague = reports.ToDictionary(r => (r.CompetitionCode, r.GroupCode));

            var toEnqueue = new List<LeagueSquadStatsReport>();
            foreach (var league in coachLeagues)
            {
                var key = (league.CompetitionId.ToString(), league.GroupId.ToString());
                if (!reportsByLeague.TryGetValue(key, out var report))
                {
                    report = LeagueSquadStatsReport.Create(seasonId, previousSeasonId, key.Item1, key.Item2, now);
                    db.LeagueSquadStatsReports.Add(report);
                    reportsByLeague[key] = report;
                    toEnqueue.Add(report);
                    continue;
                }

                var isDue = report.RequestedAt < dueBeforeUtc;
                if (isDue && report.RequestRefresh(now))
                    toEnqueue.Add(report);
            }

            await db.SaveChangesAsync(cancellationToken);
            foreach (var report in toEnqueue)
                await queue.EnqueueAsync(report.Id, cancellationToken);

            return toEnqueue.Count;
        }
    }

    /// <summary>
    /// Lanza la actualización semanal de las estadísticas de liga. Al arrancar recupera la ejecución
    /// que se hubiera perdido con el servidor parado; un fallo nunca detiene el planificador.
    /// </summary>
    public class LeagueSquadStatsScheduler(
        IServiceScopeFactory scopeFactory,
        TimeProvider timeProvider,
        IOptions<RffmOptions> rffmOptions,
        ILogger<LeagueSquadStatsScheduler> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var settings = rffmOptions.Value.LeagueSquadStats;
            if (!settings.WeeklyEnabled) return;

            var schedule = WeeklySchedule.From(settings.WeeklyDay, settings.WeeklyTime);
            try
            {
                await RunAsync(schedule.LastRun(timeProvider.GetUtcNow()), stoppingToken);

                while (!stoppingToken.IsCancellationRequested)
                {
                    var nextRun = schedule.NextRun(timeProvider.GetUtcNow());
                    await Task.Delay(nextRun - timeProvider.GetUtcNow(), timeProvider, stoppingToken);
                    await RunAsync(nextRun, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
            }
        }

        private async Task RunAsync(DateTimeOffset dueBefore, CancellationToken stoppingToken)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<ILeagueSquadStatsScheduleService>();
                var enqueued = await service.EnqueueDueAsync(dueBefore.UtcDateTime, stoppingToken);
                logger.LogInformation("Actualización semanal de estadísticas de liga: {Count} ligas encoladas", enqueued);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error lanzando la actualización semanal de estadísticas de liga");
            }
        }
    }
}
