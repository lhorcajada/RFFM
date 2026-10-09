namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class AvailabilityRequestStatus
    {
        public static readonly AvailabilityRequestStatus Requested = new(1, "Requested");
        public static readonly AvailabilityRequestStatus Available = new(2, "Available");
        public static readonly AvailabilityRequestStatus Unavailable = new(3, "Unavailable");

        public int Id { get; }
        public string Name { get; }

        private AvailabilityRequestStatus(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<AvailabilityRequestStatus> List() => new[] { Requested, Available, Unavailable };

        public static AvailabilityRequestStatus From(int id)
            => List().SingleOrDefault(s => s.Id == id)
               ?? throw new ArgumentException($"Possible values for AvailabilityRequestStatus: {string.Join(",", List().Select(s => s.Name))}");
    }
}
