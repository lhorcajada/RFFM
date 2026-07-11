using RFFM.Api.Domain.Resources;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class UserClub : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; set; } = string.Empty;
        public string ClubId { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public bool IsCreator { get; set; }
        public Club Club { get; set; } = null!;
        public Membership Membership { get; set; } = null!;

        private UserClub() { }
        public UserClub(string applicationUserId,
            string clubId, int membershipId)
        {
            UpdateRoleId(membershipId);
            UpdateApplicationUserId(applicationUserId);
            UpdateClubId(clubId);
        }

        public void UpdateRoleId(int id)
        {
            var membership = Membership.GetById(id);
            if (membership is null)
                throw new DomainException("UserClub",
                    CodeMessages.UserClubNotRolePermissive.Message,
                    CodeMessages.UserClubNotRolePermissive.Code);
            RoleId = id;
        }

        public void UpdateApplicationUserId(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
                throw new DomainException("UserClub",
                    CodeMessages.UserClubNotValidUserId.Message,
                    CodeMessages.UserClubNotValidUserId.Code);
            ApplicationUserId = id;
        }
        public void UpdateClubId (string id)
        {
            if (string.IsNullOrWhiteSpace(id))
                throw new DomainException("UserClub",
                    CodeMessages.UserClubNotValidClubId.Message,
                    CodeMessages.UserClubNotValidClubId.Code);
            ClubId = id;
        }
    }
}
