namespace RFFM.Api.Domain.Entities.Federation
{
    public class RffmSeasonPreference : BaseEntity
    {
        public string UserId { get; private set; }
        public int SeasonId { get; private set; }

        private RffmSeasonPreference() { }

        public RffmSeasonPreference(string userId, int seasonId)
        {
            ValidateUserId(userId);
            UserId = userId;
            SeasonId = seasonId;
        }

        public void UpdateSeason(int seasonId)
        {
            SeasonId = seasonId;
        }

        private static void ValidateUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("UserId no puede estar vacío");
        }
    }
}
