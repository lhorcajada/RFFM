namespace RFFM.Api.Domain.Aggregates.Assistances
{
    /// <summary>
    /// Pure date-generation logic for recurring events. No DB/EF dependency so it can be unit
    /// tested directly and shared between CreateSportEventValidator (counting/rejecting) and the
    /// CreateSportEvent endpoint handler (actually building the instances) — see design.md §4/§5.
    /// </summary>
    public static class RecurrenceScheduler
    {
        public static IReadOnlyList<DateTime> GenerateDates(DateTime startUtc, RecurrenceFrequency frequency, DateTime endUtc)
        {
            var dates = new List<DateTime>();
            var cursor = startUtc;
            // Compare by day so an end date with a 00:00 time-of-day still includes an occurrence
            // that lands earlier that same day (the master's time-of-day is reused for every
            // instance; endDate is a date-only picker value on the frontend).
            while (cursor.Date <= endUtc.Date)
            {
                dates.Add(cursor);
                cursor = frequency.Next(cursor);
            }
            return dates;
        }
    }
}
