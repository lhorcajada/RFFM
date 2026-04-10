namespace RFFM.Api.Domain.ValueObjects.Player
{
    public class PlayerInjury : ValueObject
    {
        public DateTime StartDate { get; private set; }
        public string InjuryType { get; private set; } = null!;
        public string? Description { get; private set; }
        public string? EstimatedRecovery { get; private set; }

        public PlayerInjury() { }

        public PlayerInjury(DateTime startDate, string injuryType, string? description, string? estimatedRecovery)
        {
            if (string.IsNullOrWhiteSpace(injuryType))
                throw new ArgumentException("El tipo de lesión es obligatorio.");
            StartDate = startDate;
            InjuryType = injuryType;
            Description = description;
            EstimatedRecovery = estimatedRecovery;
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return StartDate;
            yield return InjuryType;
            yield return Description;
            yield return EstimatedRecovery;
        }
    }
}
