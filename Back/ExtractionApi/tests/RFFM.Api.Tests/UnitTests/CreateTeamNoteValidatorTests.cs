#nullable enable
using RFFM.Api.Features.Coaches.Notes;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateTeamNoteValidatorTests
    {
        [Fact]
        public void Validate_ValidText_IsValid()
        {
            var command = new CreateTeamNote.CreateTeamNoteCommand { TeamId = "team-1", Text = "Traed las espinilleras" };
            var validator = new CreateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyText_IsInvalid()
        {
            var command = new CreateTeamNote.CreateTeamNoteCommand { TeamId = "team-1", Text = "" };
            var validator = new CreateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WhitespaceOnlyText_IsInvalid()
        {
            var command = new CreateTeamNote.CreateTeamNoteCommand { TeamId = "team-1", Text = "   " };
            var validator = new CreateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_TextOver500Chars_IsInvalid()
        {
            var command = new CreateTeamNote.CreateTeamNoteCommand { TeamId = "team-1", Text = new string('a', 501) };
            var validator = new CreateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_TextExactly500Chars_IsValid()
        {
            var command = new CreateTeamNote.CreateTeamNoteCommand { TeamId = "team-1", Text = new string('a', 500) };
            var validator = new CreateTeamNote.Validator();
            var result = validator.Validate(command);
            Assert.True(result.IsValid);
        }
    }
}
