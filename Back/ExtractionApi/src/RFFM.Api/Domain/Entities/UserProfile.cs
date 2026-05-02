namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Stores the app profile a user has chosen (role + optional player/team association).
    /// One record per user. Upserted when the user completes role onboarding.
    /// </summary>
    public class UserProfile : BaseEntity
    {
        public string ApplicationUserId { get; set; } = string.Empty;

        /// <summary>Identity role name chosen (e.g. "Player", "FamilyMember", "Fan", "ClubMember").</summary>
        public string RoleName { get; set; } = string.Empty;

        /// <summary>Player entity Id when role is Player or FamilyMember.</summary>
        public string? PlayerId { get; set; }

        /// <summary>Team Id the user is associated with.</summary>
        public string? TeamId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        private UserProfile() { }

        public UserProfile(string applicationUserId, string roleName, string? playerId, string? teamId)
        {
            ApplicationUserId = applicationUserId;
            RoleName = roleName;
            PlayerId = playerId;
            TeamId = teamId;
        }

        public void Update(string roleName, string? playerId, string? teamId)
        {
            RoleName = roleName;
            PlayerId = playerId;
            TeamId = teamId;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
