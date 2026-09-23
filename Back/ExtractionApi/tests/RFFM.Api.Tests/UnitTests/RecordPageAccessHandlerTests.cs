#nullable enable
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using Moq;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.Features.Audit;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RecordPageAccessHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        public RecordPageAccessHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task Handle_ValidRequest_LogsPageAccessAndSaves()
        {
            await using var db = _fixture.CreateDbContext();
            var auditLoggerMock = new Mock<IAuditLogger>();
            var handler = new RecordPageAccess.Handler(db, auditLoggerMock.Object);

            await handler.Handle(new RecordPageAccess.RecordPageAccessCommand
            {
                PageIdentifier = "Roster", ClubId = "club-1", TeamId = "team-1"
            }, CancellationToken.None);

            auditLoggerMock.Verify(a => a.LogAsync(
                AuditEventType.PageAccess, "Roster", "Success",
                null, null, "club-1", "team-1", null, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Validator_EmptyPageIdentifier_Fails(string pageId)
        {
            var validator = new RecordPageAccess.RecordPageAccessValidator();
            var cmd = new RecordPageAccess.RecordPageAccessCommand { PageIdentifier = pageId };

            var result = validator.Validate(cmd);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_PageIdentifierOverMaxLength_Fails()
        {
            var validator = new RecordPageAccess.RecordPageAccessValidator();
            var cmd = new RecordPageAccess.RecordPageAccessCommand
            {
                PageIdentifier = new string('a', 101) // over max 100
            };

            var result = validator.Validate(cmd);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_ValidPageIdentifier_Succeeds()
        {
            var validator = new RecordPageAccess.RecordPageAccessValidator();
            var cmd = new RecordPageAccess.RecordPageAccessCommand { PageIdentifier = "Roster" };

            var result = validator.Validate(cmd);

            Assert.True(result.IsValid);
        }
    }
}
