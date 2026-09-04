#nullable enable
using RFFM.Api.Features.Coaches.Notes;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class UpdateTeamNoteValidatorTests
    {
        [Fact]
        public void Validate_ValidText_IsValid()
        {
            var command = new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = "team-1", NoteId = "note-1", Text = "Texto actualizado" };
            var validator = new UpdateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyText_IsInvalid()
        {
            var command = new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = "team-1", NoteId = "note-1", Text = "" };
            var validator = new UpdateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_TextOver500Chars_IsInvalid()
        {
            var command = new UpdateTeamNote.UpdateTeamNoteCommand { TeamId = "team-1", NoteId = "note-1", Text = new string('a', 501) };
            var validator = new UpdateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }
    }
}
