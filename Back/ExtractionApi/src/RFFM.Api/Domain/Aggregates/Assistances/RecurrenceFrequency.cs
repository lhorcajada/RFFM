namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class RecurrenceFrequency
    {
        private static readonly RecurrenceFrequency Daily = new(1, "Diaria");
        private static readonly RecurrenceFrequency Weekly = new(2, "Semanal");
        private static readonly RecurrenceFrequency Monthly = new(3, "Mensual");

        public int Id { get; }
        public string Name { get; }

        private RecurrenceFrequency(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<RecurrenceFrequency> List() => new[] { Daily, Weekly, Monthly };

        public static RecurrenceFrequency From(int id)
        {
            var frequency = List().SingleOrDefault(f => f.Id == id);
            if (frequency == null)
                throw new ArgumentException($"Possible values for RecurrenceFrequency: {string.Join(",", List().Select(f => f.Name))}");
            return frequency;
        }

        public static RecurrenceFrequency FromCode(string? code)
        {
            return code?.Trim().ToLowerInvariant() switch
            {
                "daily" => Daily,
                "weekly" => Weekly,
                "monthly" => Monthly,
                _ => throw new ArgumentException("Possible values for Recurrence.Frequency: daily, weekly, monthly"),
            };
        }

        public static bool IsValidCode(string? code) =>
            code is not null && new[] { "daily", "weekly", "monthly" }.Contains(code.Trim().ToLowerInvariant());

        public DateTime Next(DateTime from) => Id switch
        {
            1 => from.AddDays(1),
            2 => from.AddDays(7),
            3 => from.AddMonths(1),
            _ => throw new InvalidOperationException("Unknown recurrence frequency"),
        };
    }
}
