#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SetPieceRuleTests
    {
        [Fact]
        public void Create_WithSaqueCentroSubtype_Succeeds()
        {
            var rule = new SetPieceRule("game-model-1", "saque-centro", "texto");

            Assert.Equal("saque-centro", rule.Subtype);
        }

        [Theory]
        [InlineData("filosofia-general")]
        [InlineData("formato-reducido")]
        public void Create_WithRemovedSubtype_Throws(string subtype)
        {
            Assert.Throws<ArgumentException>(() => new SetPieceRule("game-model-1", subtype, "texto"));
        }
    }
}
