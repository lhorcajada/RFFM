namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// A block of weeks within a Macrociclo dedicated to one field zone (the shared
    /// GameZone catalog: Iniciación/Creación Propia/Creación Rival/Finalización).
    /// </summary>
    public class Mesociclo : BaseEntity
    {
        public string MacrocicloId { get; private set; } = null!;
        public int Order { get; private set; }
        public string Name { get; private set; } = null!;
        public DateOnly StartDate { get; private set; }
        public DateOnly EndDate { get; private set; }
        public int GameZoneId { get; private set; }

        public List<Microciclo> Microciclos { get; private set; } = new();

        private Mesociclo() { }

        public Mesociclo(string macrocicloId, int order, string name, DateOnly startDate, DateOnly endDate, int gameZoneId)
        {
            if (string.IsNullOrWhiteSpace(macrocicloId))
                throw new ArgumentException("MacrocicloId cannot be empty.", nameof(macrocicloId));
            MacrocicloId = macrocicloId;
            UpdateOrder(order);
            UpdateName(name);
            Reschedule(startDate, endDate);
            UpdateGameZoneId(gameZoneId);
        }

        public void UpdateOrder(int order) => Order = order;

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Mesociclo name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void Reschedule(DateOnly startDate, DateOnly endDate)
        {
            if (endDate < startDate)
                throw new ArgumentException("EndDate cannot be before StartDate.", nameof(endDate));
            StartDate = startDate;
            EndDate = endDate;
        }

        public void UpdateGameZoneId(int gameZoneId)
        {
            if (gameZoneId <= 0)
                throw new ArgumentException("GameZoneId must be a positive catalog id.", nameof(gameZoneId));
            GameZoneId = gameZoneId;
        }
    }
}
