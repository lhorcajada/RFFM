using RFFM.Api.Domain.Resources;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class UserTeam : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; set; } = string.Empty;
        public string TeamId { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public bool IsCreator { get; set; }
        public DateTime JoinedAt { get; set; }
        public string? LinkedTeamPlayerId { get; private set; }

        public Team Team { get; set; } = null!;
        public Membership Membership { get; set; } = null!;
        public TeamPlayer? TeamPlayer { get; set; }

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

        public void LinkPlayer(string teamPlayerId)
        {
            if (RoleId != Membership.Player.Id && RoleId != Membership.FamilyPlayer.Id)
                throw new DomainException("UserTeam",
                    "Solo los roles Player o FamilyPlayer pueden vincularse a un jugador.",
                    ErrorCodes.LinkedPlayerRequired);
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("UserTeam",
                    "El identificador del jugador es obligatorio.",
                    ErrorCodes.LinkedPlayerRequired);
            LinkedTeamPlayerId = teamPlayerId;
        }
    }
}