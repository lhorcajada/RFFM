#nullable enable
using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Coverage for the <see cref="FamilyMemberRegistrationStatus"/> helper extracted from
    /// GetTeamPlayer.cs's inline logic (openspec change
    /// convocation-pending-confirmation-whatsapp, design.md Decision 2), so both GetTeamPlayer
    /// and GetConvocationNotificationRecipients share a single source of truth for the
    /// Approved/Pending/None rule.
    /// </summary>
    public class FamilyMemberRegistrationStatusTests
    {
        [Fact]
        public void Resolve_WithLinkedUserId_ReturnsApproved()
        {
            var status = FamilyMemberRegistrationStatus.Resolve("user-1", hasPendingAccountRequest: false);

            Assert.Equal(FamilyMemberRegistrationStatus.Approved, status);
        }

        [Fact]
        public void Resolve_WithLinkedUserId_ReturnsApproved_EvenWhenAlsoFlaggedPending()
        {
            // LinkedUserId wins regardless of a stale/duplicate pending request row.
            var status = FamilyMemberRegistrationStatus.Resolve("user-1", hasPendingAccountRequest: true);

            Assert.Equal(FamilyMemberRegistrationStatus.Approved, status);
        }

        [Fact]
        public void Resolve_WithoutLinkedUserId_WithPendingRequest_ReturnsPending()
        {
            var status = FamilyMemberRegistrationStatus.Resolve(null, hasPendingAccountRequest: true);

            Assert.Equal(FamilyMemberRegistrationStatus.Pending, status);
        }

        [Fact]
        public void Resolve_WithoutLinkedUserId_WithoutPendingRequest_ReturnsNone()
        {
            var status = FamilyMemberRegistrationStatus.Resolve(null, hasPendingAccountRequest: false);

            Assert.Equal(FamilyMemberRegistrationStatus.None, status);
        }
    }
}
