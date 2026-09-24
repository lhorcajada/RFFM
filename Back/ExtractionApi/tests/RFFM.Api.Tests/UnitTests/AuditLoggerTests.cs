#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class AuditLoggerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public AuditLoggerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Mock<ICurrentUserService> CurrentUser(string userId, string role)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.Role).Returns(role);
            mock.Setup(c => c.Roles).Returns(new[] { role });
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
        }

        private static Mock<IHttpContextAccessor> HttpContextWithForwardedFor(string ip)
        {
            var ctx = new DefaultHttpContext();
            ctx.Request.Headers["X-Forwarded-For"] = ip;
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns(ctx);
            return mock;
        }

        private static Mock<IHttpContextAccessor> HttpContextWithRemoteIp(string ip)
        {
            var ctx = new DefaultHttpContext();
            ctx.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(ip);
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns(ctx);
            return mock;
        }

        private static Mock<IHttpContextAccessor> NoHttpContext()
        {
            var mock = new Mock<IHttpContextAccessor>();
            mock.Setup(a => a.HttpContext).Returns((HttpContext?)null);
            return mock;
        }

        [Fact]
        public async Task LogAsync_AddsRowToContext_WithoutCallingSaveChanges()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Player").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            Assert.Equal(EntityState.Added, db.Entry(db.ChangeTracker.Entries<UserActivityLog>().Single().Entity).State);
            Assert.Equal(0, await db.UserActivityLogs.CountAsync()); // not yet saved
        }

        [Fact]
        public async Task LogAsync_UsesXForwardedFor_WhenPresent()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Player").Object, HttpContextWithForwardedFor("203.0.113.5").Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Equal("203.0.113.5", entry.IpAddress);
        }

        [Fact]
        public async Task LogAsync_FallsBackToRemoteIpAddress_WhenNoForwardedForHeader()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Player").Object, HttpContextWithRemoteIp("127.0.0.1").Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Equal("127.0.0.1", entry.IpAddress);
        }

        [Fact]
        public async Task LogAsync_NoHttpContext_LeavesIpAddressNull_NoException()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("user-1", "Player").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            var entry = db.ChangeTracker.Entries<UserActivityLog>().Single().Entity;
            Assert.Null(entry.IpAddress);
        }

        [Fact]
        public async Task LogAsync_UserActsAsCoach_DoesNotRecordAnything()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("coach-1", "Coach").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            Assert.Empty(db.ChangeTracker.Entries<UserActivityLog>());
        }

        [Fact]
        public async Task LogAsync_CoachWhoActsAsFamilyMember_RecordsTheAction()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.UserId).Returns("user-2");
            currentUser.Setup(c => c.Role).Returns("Coach");
            currentUser.Setup(c => c.Roles).Returns(new[] { "Coach", "FamilyMember" });
            var logger = new AuditLogger(db, currentUser.Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.ConvocationAccepted, "ConvocationStatusChanged", "Success", roleNameOverride: "FamilyMember");

            Assert.Single(db.ChangeTracker.Entries<UserActivityLog>());
        }

        [Fact]
        public async Task LogAsync_UserHasAdministratorRole_DoesNotRecordAnything()
        {
            await using var db = _fixture.CreateDbContext();
            var logger = new AuditLogger(db, CurrentUser("admin-1", "Administrator").Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            Assert.Empty(db.ChangeTracker.Entries<UserActivityLog>());
        }

        [Fact]
        public async Task LogAsync_UserHasAdministratorAmongMultipleRoles_DoesNotRecordAnything()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.UserId).Returns("admin-2");
            currentUser.Setup(c => c.Role).Returns("Coach");
            currentUser.Setup(c => c.Roles).Returns(new[] { "Coach", "Administrator" });
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);

            var logger = new AuditLogger(db, currentUser.Object, NoHttpContext().Object);

            await logger.LogAsync(AuditEventType.PageAccess, "Roster", "Success");

            Assert.Empty(db.ChangeTracker.Entries<UserActivityLog>());
        }
    }
}
