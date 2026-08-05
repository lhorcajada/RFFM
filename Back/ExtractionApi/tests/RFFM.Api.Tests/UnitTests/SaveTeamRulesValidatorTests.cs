#nullable enable
using System.Collections.Generic;
using RFFM.Api.Features.Mobile.Teams.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SaveTeamRulesValidatorTests
    {
        private static SaveTeamRules.SaveTeamRuleRequest ValidRule() => new()
        {
            ShortTitle = "Regla",
            ViolationSummary = "Violacion",
            ConsequenceSummary = "Consecuencia"
        };

        private static SaveTeamRules.SaveTeamRulesCommand ValidCommand() => new()
        {
            TeamId = "team-1",
            Title = "Titulo",
            Subtitle = "Subtitulo",
            IntroNote = "Nota inicial",
            Rules = new List<SaveTeamRules.SaveTeamRuleRequest> { ValidRule() }
        };

        [Fact]
        public void Validate_ValidCommand_IsValid()
        {
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(ValidCommand());
            Assert.True(result.IsValid);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Validate_EmptyTitle_IsInvalid(string title)
        {
            var command = ValidCommand() with { Title = title };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Validate_EmptySubtitle_IsInvalid(string subtitle)
        {
            var command = ValidCommand() with { Subtitle = subtitle };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Validate_EmptyIntroNote_IsInvalid(string introNote)
        {
            var command = ValidCommand() with { IntroNote = introNote };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_EmptyRulesList_IsInvalid()
        {
            var command = ValidCommand() with { Rules = new List<SaveTeamRules.SaveTeamRuleRequest>() };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_RuleMissingShortTitle_IsInvalid()
        {
            var rule = ValidRule() with { ShortTitle = "" };
            var command = ValidCommand() with { Rules = new List<SaveTeamRules.SaveTeamRuleRequest> { rule } };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_RuleMissingViolationSummary_IsInvalid()
        {
            var rule = ValidRule() with { ViolationSummary = "" };
            var command = ValidCommand() with { Rules = new List<SaveTeamRules.SaveTeamRuleRequest> { rule } };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_RuleMissingConsequenceSummary_IsInvalid()
        {
            var rule = ValidRule() with { ConsequenceSummary = "" };
            var command = ValidCommand() with { Rules = new List<SaveTeamRules.SaveTeamRuleRequest> { rule } };
            var validator = new SaveTeamRules.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }
    }
}
