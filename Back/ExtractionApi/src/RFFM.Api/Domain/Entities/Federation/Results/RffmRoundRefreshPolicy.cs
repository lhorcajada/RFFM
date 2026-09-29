using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public sealed class RoundRefreshReason : SmartEnum<RoundRefreshReason>
    {
        public static readonly RoundRefreshReason None = new(nameof(None), 0);
        public static readonly RoundRefreshReason NeverSynced = new(nameof(NeverSynced), 1);
        public static readonly RoundRefreshReason MissingSchedule = new(nameof(MissingSchedule), 2);
        public static readonly RoundRefreshReason AwaitingResult = new(nameof(AwaitingResult), 3);
        public static readonly RoundRefreshReason UpcomingRecheck = new(nameof(UpcomingRecheck), 4);

        private RoundRefreshReason(string name, int value) : base(name, value)
        {
        }
    }

    public class RffmResultsRefreshSettings
    {
        public int MissingScheduleRefreshHours { get; set; } = 6;
        public int AwaitingResultRefreshMinutes { get; set; } = 10;
        public int StaleResultAfterHours { get; set; } = 48;
        public int StaleResultRefreshHours { get; set; } = 24;
        public int UpcomingWindowDays { get; set; } = 7;
        public int UpcomingRefreshHours { get; set; } = 24;
        public int HalfTimeBreakMinutes { get; set; } = 10;
    }

    /// <summary>
    /// Decide si una jornada guardada debe volver a pedirse a la RFFM. Solo se pide cuando faltan datos:
    /// partidos sin horario, partidos que ya han podido terminar sin acta cerrada o partidos próximos
    /// (para detectar cambios de horario). Las horas de la RFFM son hora de Madrid.
    /// </summary>
    public static class RffmRoundRefreshPolicy
    {
        private static readonly TimeZoneInfo Madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        public static RoundRefreshReason Evaluate(RffmRound round, int matchMinutes, int matchParts, DateTime nowUtc,
            RffmResultsRefreshSettings settings)
        {
            if (round.LastSyncedAt is not { } lastSyncedAt)
                return RoundRefreshReason.NeverSynced;

            var elapsed = nowUtc - lastSyncedAt;
            var matchDuration = TimeSpan.FromMinutes(matchMinutes + settings.HalfTimeBreakMinutes * Math.Max(matchParts - 1, 0));

            foreach (var match in round.Matches.Where(m => !m.IsFinal))
            {
                if (!match.HasSchedule)
                {
                    if (elapsed >= TimeSpan.FromHours(settings.MissingScheduleRefreshHours))
                        return RoundRefreshReason.MissingSchedule;
                    continue;
                }

                var kickoffUtc = ToUtc(match.MatchDate!.Value, match.KickoffTime!.Value);
                var estimatedEndUtc = kickoffUtc + matchDuration;

                if (nowUtc >= estimatedEndUtc)
                {
                    var isStale = nowUtc - estimatedEndUtc > TimeSpan.FromHours(settings.StaleResultAfterHours);
                    var threshold = isStale
                        ? TimeSpan.FromHours(settings.StaleResultRefreshHours)
                        : TimeSpan.FromMinutes(settings.AwaitingResultRefreshMinutes);
                    if (elapsed >= threshold)
                        return RoundRefreshReason.AwaitingResult;
                    continue;
                }

                var isUpcoming = kickoffUtc > nowUtc && kickoffUtc <= nowUtc.AddDays(settings.UpcomingWindowDays);
                if (isUpcoming && elapsed >= TimeSpan.FromHours(settings.UpcomingRefreshHours))
                    return RoundRefreshReason.UpcomingRecheck;
            }

            return RoundRefreshReason.None;
        }

        private static DateTime ToUtc(DateOnly date, TimeOnly time) =>
            TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(time, DateTimeKind.Unspecified), Madrid);
    }
}
