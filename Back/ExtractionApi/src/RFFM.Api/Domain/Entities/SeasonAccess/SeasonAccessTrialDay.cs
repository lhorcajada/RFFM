using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.SeasonAccess
{
    public class SeasonAccessTrialDay : BaseEntity
    {
        public string TrialId { get; private set; } = null!;
        public DateOnly Date { get; private set; }
        public string? Label { get; private set; }

        public SeasonAccessTrial? Trial { get; private set; }
        public ICollection<SeasonAccessTrialPlayer> Players { get; private set; } = new List<SeasonAccessTrialPlayer>();

        protected SeasonAccessTrialDay() { }

        public static SeasonAccessTrialDay Create(string trialId, DateOnly date, string? label = null)
        {
            return new SeasonAccessTrialDay
            {
                TrialId = trialId,
                Date = date,
                Label = string.IsNullOrWhiteSpace(label) ? null : label.Trim()
            };
        }

        public void Update(DateOnly date, string? label)
        {
            Date = date;
            Label = string.IsNullOrWhiteSpace(label) ? null : label.Trim();
        }
    }
}
