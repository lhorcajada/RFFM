#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.UserClubs;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamNoteTests
    {
        [Fact]
        public void Create_ValidInput_SetsProperties()
        {
            var note = TeamNote.Create("team-1", "Traed las espinilleras", 1);

            Assert.Equal("team-1", note.TeamId);
            Assert.Equal("Traed las espinilleras", note.Text);
            Assert.Equal(1, note.Order);
        }

        [Fact]
        public void Create_TrimsWhitespaceFromText()
        {
            var note = TeamNote.Create("team-1", "  Texto con espacios  ", 1);

            Assert.Equal("Texto con espacios", note.Text);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_EmptyOrWhitespaceTeamId_Throws(string? teamId)
        {
            Assert.Throws<ArgumentException>(() => TeamNote.Create(teamId!, "texto", 1));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_EmptyOrWhitespaceText_Throws(string? text)
        {
            Assert.Throws<ArgumentException>(() => TeamNote.Create("team-1", text!, 1));
        }

        [Fact]
        public void UpdateText_ValidText_UpdatesAndTrims()
        {
            var note = TeamNote.Create("team-1", "Texto original", 1);

            note.UpdateText("  Texto actualizado  ");

            Assert.Equal("Texto actualizado", note.Text);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void UpdateText_EmptyOrWhitespace_ThrowsAndLeavesTextUnchanged(string? text)
        {
            var note = TeamNote.Create("team-1", "Texto original", 1);

            Assert.Throws<ArgumentException>(() => note.UpdateText(text!));
            Assert.Equal("Texto original", note.Text);
        }
    }
}
