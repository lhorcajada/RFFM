namespace RFFM.Api.Domain.Entities.Federation
{
    public class FederationSetting : BaseEntity
    {
        public string UserId { get; private set; }
        public string? CompetitionId { get; private set; }
        public string? CompetitionName { get; private set; }
        public string? GroupId { get; private set; }
        public string? GroupName { get; private set; }
        public string? TeamId { get; private set; }
        public string? TeamName { get; private set; }
        public long CreatedAt { get; private set; }
        public bool IsPrimary { get; private set; }
        public int? SeasonId { get; private set; }

        private FederationSetting() { }

        public FederationSetting(
            string userId,
            string? competitionId = null,
            string? competitionName = null,
            string? groupId = null,
            string? groupName = null,
            string? teamId = null,
            string? teamName = null,
            bool isPrimary = false,
            int? seasonId = null)
        {
            ValidateUserId(userId);
            UserId = userId;
            CompetitionId = competitionId;
            CompetitionName = competitionName;
            GroupId = groupId;
            GroupName = groupName;
            TeamId = teamId;
            TeamName = teamName;
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            IsPrimary = isPrimary;
            SeasonId = seasonId;
        }

        public void Update(
            string? competitionId = null,
            string? competitionName = null,
            string? groupId = null,
            string? groupName = null,
            string? teamId = null,
            string? teamName = null,
            bool? isPrimary = null,
            int? seasonId = null)
        {
            CompetitionId = competitionId;
            CompetitionName = competitionName;
            GroupId = groupId;
            GroupName = groupName;
            TeamId = teamId;
            TeamName = teamName;
            SeasonId = seasonId;
            if (isPrimary.HasValue)
            {
                IsPrimary = isPrimary.Value;
            }
        }

        public void SetAsPrimary()
        {
            IsPrimary = true;
        }

        public void SetAsSecondary()
        {
            IsPrimary = false;
        }

        private static void ValidateUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("UserId no puede estar vacío");
        }
    }
}
