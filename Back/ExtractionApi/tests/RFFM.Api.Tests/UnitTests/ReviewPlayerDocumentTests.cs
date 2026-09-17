#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.PlayerDocuments;
using RFFM.Api.Tests.Fixtures;
using Moq;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ReviewPlayerDocumentTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ReviewPlayerDocumentTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ApproveDeliveredDocument_SetsApprovedStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, "file.pdf", "url", "application/pdf", "user-1", false);
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("coach-1");

            var handler = new ReviewPlayerDocument.Handler(db, mockCurrentUser.Object);
            var cmd = new ReviewPlayerDocument.ReviewPlayerDocumentCommand(teamPlayerId, docType.Id, Approve: true, "OK");
            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.Equal("Approved", result.Status);
            Assert.NotNull(result.ReviewedAt);
        }

        [Fact]
        public async Task Handle_RejectDeliveredDocument_SetsRejectedStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, "file.pdf", "url", "application/pdf", "user-1", false);
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("coach-1");

            var handler = new ReviewPlayerDocument.Handler(db, mockCurrentUser.Object);
            var cmd = new ReviewPlayerDocument.ReviewPlayerDocumentCommand(teamPlayerId, docType.Id, Approve: false, "Ilegible");
            var result = await handler.Handle(cmd, CancellationToken.None);

            Assert.Equal("Rejected", result.Status);
        }

        [Fact]
        public async Task Handle_WhenDocumentNotFound_Throws()
        {
            await using var db = _fixture.CreateDbContext();
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("coach-1");

            var handler = new ReviewPlayerDocument.Handler(db, mockCurrentUser.Object);
            var cmd = new ReviewPlayerDocument.ReviewPlayerDocumentCommand("team-player-999", "doc-type-999", Approve: true, null);

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(cmd, CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_WhenDocumentNotDelivered_Throws()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, "file.pdf", "url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", "Already approved");
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.UserId).Returns("coach-2");

            var handler = new ReviewPlayerDocument.Handler(db, mockCurrentUser.Object);
            var cmd = new ReviewPlayerDocument.ReviewPlayerDocumentCommand(teamPlayerId, docType.Id, Approve: true, null);

            await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(cmd, CancellationToken.None).AsTask());
        }
    }
}
