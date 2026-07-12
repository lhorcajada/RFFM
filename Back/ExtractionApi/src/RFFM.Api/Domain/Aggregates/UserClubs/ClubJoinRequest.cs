using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public enum ClubJoinRequestStatus { Pending = 0, Approved = 1, Rejected = 2, Cancelled = 3 }

    public class ClubJoinRequest : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; private set; } = string.Empty;
        public string ClubId { get; private set; } = string.Empty;
        public int MembershipId { get; private set; }
        public ClubJoinRequestStatus Status { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? DecidedAt { get; private set; }
        public string? DecidedByUserId { get; private set; }

        public Club Club { get; set; } = null!;
        public Membership Membership { get; set; } = null!;

        private ClubJoinRequest() { }

        public static ClubJoinRequest Create(string applicationUserId, string clubId, int membershipId)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId) || string.IsNullOrWhiteSpace(clubId))
                throw new DomainException("ClubJoinRequest",
                    "El usuario y el club son obligatorios.", ErrorCodes.ClubInvitationCodeRequired);

            return new ClubJoinRequest
            {
                ApplicationUserId = applicationUserId,
                ClubId = clubId,
                MembershipId = membershipId,
                Status = ClubJoinRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
        }

        public void Approve(string decidedByUserId)
        {
            EnsurePending();
            Status = ClubJoinRequestStatus.Approved;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Reject(string decidedByUserId)
        {
            EnsurePending();
            Status = ClubJoinRequestStatus.Rejected;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Cancel()
        {
            EnsurePending();
            Status = ClubJoinRequestStatus.Cancelled;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = null;
        }

        private void EnsurePending()
        {
            if (Status != ClubJoinRequestStatus.Pending)
                throw new DomainException("ClubJoinRequest",
                    "La solicitud ya ha sido decidida.", ErrorCodes.ClubJoinRequestAlreadyDecided);
        }
    }
}
