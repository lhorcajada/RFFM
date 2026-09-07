namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// One training week within a Mesociclo. Simplified per the `session-exercise-plan-redesign`
    /// OpenSpec change (design.md §1.5): no longer hard-codes an "exactly two sessions (A/B)"
    /// shape with its own objective/zone/model-link duplication — it now optionally has any
    /// number of linked <see cref="Training.TrainingSession"/> rows (queried via
    /// <see cref="Training.TrainingSession.MicrocicloId"/>, not stored as a collection here, same
    /// FK-on-the-child convention already used elsewhere in this codebase), each fully
    /// self-describing.
    /// </summary>
    public class Microciclo : BaseEntity
    {
        public string MesocicloId { get; private set; } = null!;
        public int Order { get; private set; }
        public string WeekLabel { get; private set; } = null!;
        public DateOnly StartDate { get; private set; }
        public DateOnly EndDate { get; private set; }

        private Microciclo() { }

        public Microciclo(string mesocicloId, int order, string weekLabel, DateOnly startDate, DateOnly endDate)
        {
            if (string.IsNullOrWhiteSpace(mesocicloId))
                throw new ArgumentException("MesocicloId cannot be empty.", nameof(mesocicloId));
            MesocicloId = mesocicloId;
            UpdateOrder(order);
            UpdateWeekLabel(weekLabel);
            Reschedule(startDate, endDate);
        }

        public void UpdateOrder(int order) => Order = order;

        public void UpdateWeekLabel(string weekLabel)
        {
            if (string.IsNullOrWhiteSpace(weekLabel))
                throw new ArgumentException("WeekLabel cannot be empty.", nameof(weekLabel));
            WeekLabel = weekLabel.Trim();
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
