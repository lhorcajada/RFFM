#nullable enable
using RFFM.Api.Domain.Entities.Audit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UserActivityLogTests
    {
        [Fact]
        public void Create_WithAllRequiredFields_Succeeds()
        {
            var log = UserActivityLog.Create(
                userId: "user-1", roleName: "Coach", clubId: "club-1", teamId: "team-1",
                ipAddress: "127.0.0.1", eventType: AuditEventType.PageAccess,
                actionOrPage: "Roster", result: "Success", reason: null, subjectId: null);

            Assert.Equal("user-1", log.UserId);
            Assert.Equal("Coach", log.RoleName);
            Assert.Equal("club-1", log.ClubId);
            Assert.Equal("team-1", log.TeamId);
            Assert.Equal("127.0.0.1", log.IpAddress);
            Assert.Equal(AuditEventType.PageAccess.Name, log.EventType);
            Assert.Equal("Roster", log.ActionOrPage);
            Assert.Equal("Success", log.Result);
            Assert.Null(log.Reason);
            Assert.Null(log.SubjectId);
            Assert.True((DateTime.UtcNow - log.Timestamp).TotalSeconds < 5);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Create_ForConvocationRejected_RequiresNonEmptyReason(string? reason)
        {
            Assert.Throws<ArgumentException>(() => UserActivityLog.Create(
                "user-1", "Player", null, "team-1", null,
                AuditEventType.ConvocationRejected, "ConvocationStatusChanged", "Success", reason, "conv-1"));
        }

        [Fact]
        public void Create_ForConvocationRejected_WithReason_Succeeds()
        {
            var log = UserActivityLog.Create(
                "user-1", "Player", null, "team-1", null,
                AuditEventType.ConvocationRejected, "ConvocationStatusChanged", "Success", "Lesión", "conv-1");

            Assert.Equal("Lesión", log.Reason);
        }

        [Theory]
        [InlineData("PageAccess")]
        [InlineData("ConvocationAccepted")]
        [InlineData("PlayerEdited")]
        public void Create_ForNonRejectionEventTypes_AllowsNullReason(string eventTypeName)
        {
            var eventType = AuditEventType.FromName(eventTypeName);

            var log = UserActivityLog.Create(
                "user-1", "Coach", "club-1", null, null, eventType, "Action", "Success", null, null);

            Assert.Null(log.Reason);
        }

        [Fact]
        public void Create_AllowsClubIdTeamIdIpAddressSubjectIdAllNull()
        {
            var log = UserActivityLog.Create(
                "user-1", "Federation", null, null, null,
                AuditEventType.PageAccess, "Dashboard", "Success", null, null);

            Assert.Null(log.ClubId);
            Assert.Null(log.TeamId);
            Assert.Null(log.IpAddress);
            Assert.Null(log.SubjectId);
        }
    }
}
