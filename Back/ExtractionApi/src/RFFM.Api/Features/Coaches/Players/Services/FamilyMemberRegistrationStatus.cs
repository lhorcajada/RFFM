namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Resolves a <see cref="Domain.Entities.TeamPlayers.TeamPlayerFamilyMember"/>'s app-account
    /// registration status, extracted from GetTeamPlayer.cs's original inline logic (openspec
    /// change convocation-pending-confirmation-whatsapp, design.md Decision 2) so both
    /// GetTeamPlayer and GetConvocationNotificationRecipients share a single source of truth
    /// instead of duplicating the Approved/Pending/None rule.
    /// </summary>
    public static class FamilyMemberRegistrationStatus
    {
        public const string Approved = "Approved";
        public const string Pending = "Pending";
        public const string None = "None";

        /// <summary>
        /// A linked user account always wins (Approved), regardless of any pending request row.
        /// Otherwise, an open <c>FamilyMemberAccountRequest</c> means Pending; no account and no
        /// open request means None.
        /// </summary>
        public static string Resolve(string? linkedUserId, bool hasPendingAccountRequest)
        {
            if (linkedUserId is not null)
                return Approved;

            return hasPendingAccountRequest ? Pending : None;
        }
    }
}
