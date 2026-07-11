using RFFM.Api.Domain.Resources;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class UserTeam : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; set; } = string.Empty;
        public string TeamId { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public bool IsCreator { get; set; }
        public DateTime JoinedAt { get; set; }

        public Team Team { get; set; } = null!;
        public Membership Membership { get; set; } = null!;

        private UserTeam() { }

        public UserTeam(string applicationUserId, string teamId, int membershipId)
        {
            UpdateRoleId(membershipId);
            UpdateApplicationUserId(applicationUserId);
            UpdateTeamId(teamId);
            MarkAsJoined();
        }

        public void UpdateRoleId(int id)
        {
            var membership = Membership.GetById(id);
            if (membership is null)
                throw new DomainException("UserTeam",
                    CodeMessages.UserClubNotRolePermissive.Message,
                    CodeMessages.UserClubNotRolePermissive.Code);
            RoleId = id;
        }

        public void UpdateApplicationUserId(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
                throw new DomainException("UserTeam",
                    CodeMessages.UserClubNotValidUserId.Message,
                    CodeMessages.UserClubNotValidUserId.Code);
            ApplicationUserId = id;
        }

        public void UpdateTeamId(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
                throw new DomainException("UserTeam",
                    CodeMessages.UserClubNotValidClubId.Message,
                    CodeMessages.UserClubNotValidClubId.Code);
            TeamId = id;
        }

        public void MarkAsCreator()
        {
            IsCreator = true;
        }

        public void MarkAsJoined()
        {
            JoinedAt = DateTime.UtcNow;
        }
    }
}