namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    public class Macrociclo : BaseEntity
    {
        public string SeasonPlanId { get; private set; } = null!;
        public int Order { get; private set; }
        public string Name { get; private set; } = null!;
        public DateOnly StartDate { get; private set; }
        public DateOnly EndDate { get; private set; }

        public List<Mesociclo> Mesociclos { get; private set; } = new();

        private Macrociclo() { }

        public Macrociclo(string seasonPlanId, int order, string name, DateOnly startDate, DateOnly endDate)
        {
            if (string.IsNullOrWhiteSpace(seasonPlanId))
                throw new ArgumentException("SeasonPlanId cannot be empty.", nameof(seasonPlanId));
            SeasonPlanId = seasonPlanId;
            UpdateOrder(order);
            UpdateName(name);
            Reschedule(startDate, endDate);
        }

        public void UpdateOrder(int order) => Order = order;

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Macrociclo name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void Reschedule(DateOnly startDate, DateOnly endDate)
        {
            if (endDate < startDate)
                throw new ArgumentException("EndDate cannot be before StartDate.", nameof(endDate));
            StartDate = startDate;
            EndDate = endDate;
        }
    }
}
