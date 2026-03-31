namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class AvailabilityType
    {
        public static readonly AvailabilityType Available = new AvailabilityType(1, "Disponible");
        public static readonly AvailabilityType NotAvailable = new AvailabilityType(2, "No disponible");

        public int Id { get; private set; }
        public string Name { get; private set; } = null!;

        private AvailabilityType() { }

        private AvailabilityType(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<AvailabilityType> List() => new[] { Available, NotAvailable };

        public static AvailabilityType? FromId(int id) =>
            List().SingleOrDefault(a => a.Id == id);
    }
}
