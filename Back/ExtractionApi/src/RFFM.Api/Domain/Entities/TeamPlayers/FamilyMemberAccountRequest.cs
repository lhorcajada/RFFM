using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public enum FamilyMemberAccountRequestStatus { Pending = 0, Approved = 1, Rejected = 2 }

    public class FamilyMemberAccountRequest : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; private set; } = string.Empty;
        public string TeamPlayerFamilyMemberId { get; private set; } = string.Empty;
        public string TeamPlayerId { get; private set; } = string.Empty;
        public FamilyMemberAccountRequestStatus Status { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? DecidedAt { get; private set; }
        public string? DecidedByUserId { get; private set; }

        public TeamPlayerFamilyMember TeamPlayerFamilyMember { get; set; } = null!;
        public TeamPlayer TeamPlayer { get; set; } = null!;

        private FamilyMemberAccountRequest() { }

        public static FamilyMemberAccountRequest Create(
            string applicationUserId, string teamPlayerFamilyMemberId, string teamPlayerId)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId)
                || string.IsNullOrWhiteSpace(teamPlayerFamilyMemberId)
                || string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("FamilyMemberAccountRequest",
                    "El usuario y el familiar son obligatorios.", ErrorCodes.FamilyMemberEmailRequired);

            return new FamilyMemberAccountRequest
            {
                ApplicationUserId = applicationUserId,
                TeamPlayerFamilyMemberId = teamPlayerFamilyMemberId,
                TeamPlayerId = teamPlayerId,
                Status = FamilyMemberAccountRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
        }

        public void Approve(string decidedByUserId)
        {
            EnsurePending();
            Status = FamilyMemberAccountRequestStatus.Approved;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Reject(string decidedByUserId)
        {
            EnsurePending();
            Status = FamilyMemberAccountRequestStatus.Rejected;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        private void EnsurePending()
        {
            if (Status != FamilyMemberAccountRequestStatus.Pending)
                throw new DomainException("FamilyMemberAccountRequest",
                    "La solicitud ya ha sido decidida.", ErrorCodes.FamilyMemberAccountRequestAlreadyDecided);
        }
    }
}
