#nullable enable
using RFFM.Api.Domain.Entities.PlayerDocuments;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerDocumentTests
    {
        [Fact]
        public void Create_SetsDeliveredStatusAndUploadMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "autorizacion.pdf",
                "player-documents/team-player-1/document-type-1/abc.pdf", "application/pdf",
                uploadedByUserId: "user-1", uploadedOnBehalf: false);

            Assert.Equal("team-player-1", doc.TeamPlayerId);
            Assert.Equal("document-type-1", doc.DocumentTypeId);
            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.Equal("autorizacion.pdf", doc.FileName);
            Assert.Equal("player-documents/team-player-1/document-type-1/abc.pdf", doc.StorageUrl);
            Assert.Equal("application/pdf", doc.ContentType);
            Assert.Equal("user-1", doc.UploadedByUserId);
            Assert.False(doc.UploadedOnBehalf);
            Assert.NotNull(doc.UploadedAt);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewedAt);
            Assert.Null(doc.ReviewNote);
        }

        [Theory]
        [InlineData("", "document-type-1")]
        [InlineData("team-player-1", "")]
        public void Create_RequiresTeamPlayerIdAndDocumentTypeId(string teamPlayerId, string documentTypeId)
        {
            Assert.Throws<ArgumentException>(() => PlayerDocument.Create(
                teamPlayerId, documentTypeId, "file.pdf", "url", "application/pdf", "user-1", false));
        }

        [Fact]
        public void ReplaceFile_ResetsToDeliveredAndClearsReviewFields_WhenPreviouslyApproved()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "old.pdf", "old-url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", "Todo correcto");

            doc.ReplaceFile("new.pdf", "new-url", "image/jpeg", "user-1", false);

            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.Equal("new.pdf", doc.FileName);
            Assert.Equal("new-url", doc.StorageUrl);
            Assert.Equal("image/jpeg", doc.ContentType);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewedAt);
            Assert.Null(doc.ReviewNote);
        }

        [Fact]
        public void ReplaceFile_ResetsToDeliveredAndClearsReviewFields_WhenPreviouslyRejected()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "old.pdf", "old-url", "application/pdf", "user-1", false);
            doc.Reject("coach-1", "Firma ilegible");

            doc.ReplaceFile("new.pdf", "new-url", "application/pdf", "user-1", true);

            Assert.Equal(PlayerDocumentStatus.Delivered, doc.Status);
            Assert.True(doc.UploadedOnBehalf);
            Assert.Null(doc.ReviewedByUserId);
            Assert.Null(doc.ReviewNote);
        }

        [Fact]
        public void Approve_FromDelivered_SetsApprovedStatusAndReviewMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);

            doc.Approve("coach-1", "Correcto");

            Assert.Equal(PlayerDocumentStatus.Approved, doc.Status);
            Assert.Equal("coach-1", doc.ReviewedByUserId);
            Assert.Equal("Correcto", doc.ReviewNote);
            Assert.NotNull(doc.ReviewedAt);
        }

        [Fact]
        public void Reject_FromDelivered_SetsRejectedStatusAndReviewMetadata()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);

            doc.Reject("coach-1", "Firma ilegible");

            Assert.Equal(PlayerDocumentStatus.Rejected, doc.Status);
            Assert.Equal("coach-1", doc.ReviewedByUserId);
            Assert.Equal("Firma ilegible", doc.ReviewNote);
        }

        [Fact]
        public void Approve_WhenNotDelivered_Throws()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);
            doc.Approve("coach-1", null);

            var ex = Assert.Throws<InvalidOperationException>(() => doc.Approve("coach-1", null));
            Assert.Contains("Delivered", ex.Message);
        }

        [Fact]
        public void Reject_WhenNotDelivered_Throws()
        {
            var doc = PlayerDocument.Create(
                "team-player-1", "document-type-1", "file.pdf", "url", "application/pdf", "user-1", false);
            doc.Reject("coach-1", "x");

            Assert.Throws<InvalidOperationException>(() => doc.Reject("coach-1", "y"));
        }
    }
}
