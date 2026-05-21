using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.SeasonAccess
{
    public class SeasonAccessTrial : BaseEntity
    {
        public string ApplicationUserId { get; private set; } = null!;
        public string SeasonId { get; private set; } = null!;
        public string Category { get; private set; } = null!;

        public ICollection<SeasonAccessTrialPlayer> Players { get; private set; } = new List<SeasonAccessTrialPlayer>();
        public ICollection<SeasonAccessTrialDay> TrialDays { get; private set; } = new List<SeasonAccessTrialDay>();

        protected SeasonAccessTrial() { }

        public static SeasonAccessTrial Create(string applicationUserId, string seasonId, string category)
        {
            return new SeasonAccessTrial
            {
                ApplicationUserId = applicationUserId,
                SeasonId = seasonId,
                Category = category,
            };
        }

        public void UpdateCategory(string category)
        {
            Category = category;
        }
    }
}