using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public enum TeamPlayerLinkRequestStatus { Pending = 0, Approved = 1, Rejected = 2, Cancelled = 3 }

    public class TeamPlayerLinkRequest : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; private set; } = string.Empty;
        public string TeamId { get; private set; } = string.Empty;
        public string TeamPlayerId { get; private set; } = string.Empty;
        public int MembershipId { get; private set; }
        public TeamPlayerLinkRequestStatus Status { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? DecidedAt { get; private set; }
        public string? DecidedByUserId { get; private set; }

        public Team Team { get; set; } = null!;
        public TeamPlayer TeamPlayer { get; set; } = null!;
        public Membership Membership { get; set; } = null!;

        private TeamPlayerLinkRequest() { }

        public static TeamPlayerLinkRequest Create(string applicationUserId, string teamId, string teamPlayerId, int membershipId)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId) || string.IsNullOrWhiteSpace(teamId) || string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("TeamPlayerLinkRequest",
                    "El usuario, el equipo y el jugador son obligatorios.", ErrorCodes.LinkedPlayerRequired);

            return new TeamPlayerLinkRequest
            {
                ApplicationUserId = applicationUserId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                MembershipId = membershipId,
                Status = TeamPlayerLinkRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
        }

        public void Approve(string decidedByUserId)
        {
            EnsurePending();
            Status = TeamPlayerLinkRequestStatus.Approved;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Reject(string decidedByUserId)
        {
            EnsurePending();
            Status = TeamPlayerLinkRequestStatus.Rejected;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        private void EnsurePending()
        {
            if (Status != TeamPlayerLinkRequestStatus.Pending)
                throw new DomainException("TeamPlayerLinkRequest",
                    "La solicitud ya ha sido decidida.", ErrorCodes.TeamPlayerLinkRequestAlreadyDecided);
        }
    }
}
