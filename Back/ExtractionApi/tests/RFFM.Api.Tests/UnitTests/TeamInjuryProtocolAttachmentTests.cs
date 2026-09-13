#nullable enable
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers TeamInjuryProtocolAttachment, the PDF attachment entity linked to a team's
    /// injury protocol (add-injury-protocol-and-documents-tabs, design.md Decisión 2).
    /// </summary>
    public class TeamInjuryProtocolAttachmentTests
    {
        [Theory]
        [InlineData("", "file.pdf", "url", "application/pdf")]
        [InlineData("protocol-1", "", "url", "application/pdf")]
        [InlineData("protocol-1", "file.pdf", "", "application/pdf")]
        [InlineData("protocol-1", "file.pdf", "url", "")]
        public void Create_RequiresAllFields(string protocolId, string fileName, string storageUrl, string contentType)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamInjuryProtocolAttachment.Create(protocolId, fileName, storageUrl, contentType));
        }

        [Fact]
        public void Create_PersistsAllFields()
        {
            var uploadedAt = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);

            var attachment = TeamInjuryProtocolAttachment.Create(
                "protocol-1", "primeros-auxilios.pdf", "injury-protocol-attachments/abc.pdf", "application/pdf", uploadedAt);

            Assert.Equal("protocol-1", attachment.ProtocolId);
            Assert.Equal("primeros-auxilios.pdf", attachment.FileName);
            Assert.Equal("injury-protocol-attachments/abc.pdf", attachment.StorageUrl);
            Assert.Equal("application/pdf", attachment.ContentType);
            Assert.Equal(uploadedAt, attachment.UploadedAt);
        }

        [Fact]
        public void Create_WithoutUploadedAt_DefaultsToUtcNow()
        {
            var before = DateTime.UtcNow;
            var attachment = TeamInjuryProtocolAttachment.Create(
                "protocol-1", "file.pdf", "url", "application/pdf");
            var after = DateTime.UtcNow;

            Assert.True(attachment.UploadedAt >= before && attachment.UploadedAt <= after);
        }
    }
}
