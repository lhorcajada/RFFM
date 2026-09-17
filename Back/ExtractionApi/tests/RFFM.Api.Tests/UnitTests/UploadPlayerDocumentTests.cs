#nullable enable
using Microsoft.AspNetCore.Http;
using Moq;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UploadPlayerDocumentTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UploadPlayerDocumentTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task ValidUpload_CreatesPlayerDocumentWithDeliveredStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var mockStorage = new Mock<IStorageService>();
            mockStorage.Setup(x => x.UploadAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync($"player-documents/{teamPlayerId}/doc-type-id/file.pdf");

            var formFile = new Mock<IFormFile>();
            formFile.Setup(x => x.Length).Returns(1000);
            formFile.Setup(x => x.ContentType).Returns("application/pdf");
            formFile.Setup(x => x.FileName).Returns("test.pdf");
            formFile.Setup(x => x.OpenReadStream()).Returns(new MemoryStream(new byte[1000]));

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, formFile.Object.FileName, $"player-documents/{teamPlayerId}/doc-type-id/file.pdf",
                formFile.Object.ContentType, "user-1", false);
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            var uploaded = db.PlayerDocuments.FirstOrDefault(pd => pd.TeamPlayerId == teamPlayerId && pd.DocumentTypeId == docType.Id);
            Assert.NotNull(uploaded);
            Assert.Equal(RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocumentStatus.Delivered, uploaded.Status);
        }

        [Fact]
        public async Task ReuploadOverApprovedDocument_ResetsToDeliveredAndClearsReview()
        {
            await using var db = _fixture.CreateDbContext();
            var teamPlayerId = await PlayerDocumentTestData.CreateTeamPlayerAsync(db);

            var docType = RFFM.Api.Domain.Entities.PlayerDocuments.DocumentType.Create("Autorización", null);
            db.DocumentTypes.Add(docType);
            await db.SaveChangesAsync();

            var doc = RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocument.Create(
                teamPlayerId, docType.Id, "old.pdf", "old-url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", "OK");
            db.PlayerDocuments.Add(doc);
            await db.SaveChangesAsync();

            doc.ReplaceFile("new.pdf", "new-url", "application/pdf", "user-2", false);
            await db.SaveChangesAsync();

            Assert.Equal(RFFM.Api.Domain.Entities.PlayerDocuments.PlayerDocumentStatus.Delivered, doc.Status);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewNote);
        }
    }
}
