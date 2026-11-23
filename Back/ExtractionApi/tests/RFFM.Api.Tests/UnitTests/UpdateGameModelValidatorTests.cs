#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>A malformed version marker is a bad request, not a stale model: only a well-formed one can be outdated.</summary>
    public class UpdateGameModelValidatorTests
    {
        private static UpdateGameModelCommand Command(string? expectedVersion) =>
            new("Modelo", new List<PrincipleRequest>(), new List<SetPieceRuleRequest>(), new List<OpenIssueRequest>(), expectedVersion)
            { Id = "game-model-1", UserId = "user-1" };

        [Fact]
        public void ExpectedVersion_WhenAbsent_IsValid()
        {
            var result = new UpdateGameModelValidator().Validate(Command(null));

            Assert.True(result.IsValid);
        }

        [Fact]
        public void ExpectedVersion_WhenAGuid_IsValid()
        {
            var result = new UpdateGameModelValidator().Validate(Command(Guid.NewGuid().ToString("D")));

            Assert.True(result.IsValid);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("not-a-guid")]
        [InlineData("12345")]
        public void ExpectedVersion_WhenMalformed_IsRejectedOnThatMember(string expectedVersion)
        {
            var result = new UpdateGameModelValidator().Validate(Command(expectedVersion));

            Assert.False(result.IsValid);
            Assert.Contains(result.Errors, e => e.PropertyName == nameof(UpdateGameModelCommand.ExpectedVersion));
        }
    }
}
