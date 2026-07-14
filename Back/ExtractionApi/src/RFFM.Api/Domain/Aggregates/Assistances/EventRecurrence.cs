using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class EventRecurrence : BaseEntity
    {
        public int FrequencyId { get; private set; }
        public DateTime EndDate { get; private set; }
        public string MasterEventId { get; private set; } = null!;
        public int InstanceCount { get; private set; }

        public SportEvent MasterEvent { get; set; } = null!;
        public List<SportEvent> Events { get; set; } = null!;

        private EventRecurrence()
        {
        }

        public static EventRecurrence Create(RecurrenceFrequency frequency, DateTime endDate, string masterEventId, int instanceCount)
        {
            if (endDate == default)
                throw new ArgumentException("La fecha final de la recurrencia no puede estar vacía");
            if (string.IsNullOrEmpty(masterEventId))
                throw new ArgumentException("El evento maestro no puede estar vacío");
            if (instanceCount is < 1 or > RecurrenceConstants.MaxInstances)
                throw new ArgumentException($"Una serie recurrente no puede generar más de {RecurrenceConstants.MaxInstances} eventos");

            return new EventRecurrence
            {
                FrequencyId = frequency.Id,
                EndDate = endDate,
                MasterEventId = masterEventId,
                InstanceCount = instanceCount,
            };
        }
    }
}
