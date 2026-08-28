using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Services
{
    /// <summary>
    /// Approves a pending <see cref="ClubJoinRequest"/>: creates the UserClub row, marks the
    /// request approved, and best-effort assigns the Identity Coach role and charges the club
    /// seat. Shared between the club-admin manual approval flow
    /// (ApproveClubJoinRequestHandler) and the coach self-approval-by-team-code flow
    /// (EnterClubTeamAsCoach.Handler).
    /// </summary>
    public interface IClubJoinRequestApprovalService
    {
        Task ApproveAsync(ClubJoinRequest joinRequest, string decidedByUserId, CancellationToken cancellationToken);
    }
}
