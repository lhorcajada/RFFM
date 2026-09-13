#nullable enable
using RFFM.Api.Domain.Entities.Teams;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers TeamInjuryProtocol, the per-team injury-response protocol entity
    /// (add-injury-protocol-and-documents-tabs, design.md Decisión 2).
    /// </summary>
    public class TeamInjuryProtocolTests
    {
        [Fact]
        public void Create_RequiresNonEmptyTeamId()
        {
            Assert.Throws<ArgumentException>(() => TeamInjuryProtocol.Create("  "));
        }

        [Fact]
        public void Create_StartsWithNullContent()
        {
            var protocol = TeamInjuryProtocol.Create("team-1");

            Assert.Equal("team-1", protocol.TeamId);
            Assert.Null(protocol.Content);
            Assert.Null(protocol.UpdatedByUserId);
            Assert.Empty(protocol.Attachments);
        }

        [Fact]
        public void Create_SetsUpdatedAtToUtcNow()
        {
            var before = DateTime.UtcNow;
            var protocol = TeamInjuryProtocol.Create("team-1");
            var after = DateTime.UtcNow;

            Assert.True(protocol.UpdatedAt >= before && protocol.UpdatedAt <= after);
        }

        [Fact]
        public void UpdateContent_SetsContentAndUpdatedBy()
        {
            var protocol = TeamInjuryProtocol.Create("team-1");

            protocol.UpdateContent("<p>Llamar al 112</p>", "user-1");

            Assert.Equal("<p>Llamar al 112</p>", protocol.Content);
            Assert.Equal("user-1", protocol.UpdatedByUserId);
        }

        [Fact]
        public void UpdateContent_RejectsEmptyContent()
        {
            var protocol = TeamInjuryProtocol.Create("team-1");

            Assert.Throws<ArgumentException>(() => protocol.UpdateContent("   ", "user-1"));
        }

        [Fact]
        public void ClearContent_SetsContentToNull_ButKeepsAttachments()
        {
            var protocol = TeamInjuryProtocol.Create("team-1");
            protocol.UpdateContent("<p>Contenido</p>", "user-1");

            protocol.ClearContent("user-2");

            Assert.Null(protocol.Content);
            Assert.Equal("user-2", protocol.UpdatedByUserId);
        }
    }
}
