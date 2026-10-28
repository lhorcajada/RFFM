#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Features.Audit;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteAuditLogEntriesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        public DeleteAuditLogEntriesHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static UserActivityLog NewLog() => UserActivityLog.Create(
            userId: "user-" + Guid.NewGuid().ToString("N").Substring(0, 6),
            roleName: "Coach",
            clubId: null,
            teamId: null,
            ipAddress: "192.168.1.1",
            eventType: AuditEventType.PageAccess,
            actionOrPage: "Roster",
            result: "Success",
            reason: null,
            subjectId: null);

        [Fact]
        public async Task Handle_DeletesOnlyRequestedIds_IgnoresUnknownIds_AndReturnsDeletedCount()
        {
            await using var db = _fixture.CreateDbContext();
            var requested1 = NewLog();
            var requested2 = NewLog();
            var untouched = NewLog();
            db.UserActivityLogs.AddRange(requested1, requested2, untouched);
            await db.SaveChangesAsync();

            var unknownId = "missing-" + Guid.NewGuid().ToString("N");
            var handler = new DeleteAuditLogEntries.Handler(db);
            var command = new DeleteAuditLogEntries.DeleteAuditLogEntriesCommand(
                new[] { requested1.Id, requested2.Id, unknownId });

            var response = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(2, response.Deleted);
            var remaining = await db.UserActivityLogs.AsNoTracking()
                .Where(a => new[] { requested1.Id, requested2.Id, untouched.Id }.Contains(a.Id))
                .Select(a => a.Id)
                .ToArrayAsync();
            Assert.Equal(new[] { untouched.Id }, remaining);
        }
    }
}
