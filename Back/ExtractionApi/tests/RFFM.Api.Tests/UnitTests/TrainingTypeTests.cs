#nullable enable
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TrainingTypeTests
    {
        [Fact]
        public void List_ContainsExactlyTheThreeClosedVocabularyCodes()
        {
            var codes = TrainingType.List().Select(t => t.Code).ToList();

            Assert.Equal(3, codes.Count);
            Assert.Contains("Fisico", codes);
            Assert.Contains("Tecnico", codes);
            Assert.Contains("Tactico", codes);
        }

        [Fact]
        public void List_HasCorrectSpanishNames()
        {
            var types = TrainingType.List().ToList();

            Assert.Contains(types, t => t.Code == "Fisico" && t.Name == "Físico");
            Assert.Contains(types, t => t.Code == "Tecnico" && t.Name == "Técnico");
            Assert.Contains(types, t => t.Code == "Tactico" && t.Name == "Táctico");
        }

        [Theory]
        [InlineData("Fisico")]
        [InlineData("Tecnico")]
        [InlineData("Tactico")]
        public void IsValidCode_WithKnownCode_ReturnsTrue(string code)
        {
            Assert.True(TrainingType.IsValidCode(code));
        }

        [Fact]
        public void IsValidCode_WithUnknownCode_ReturnsFalse()
        {
            Assert.False(TrainingType.IsValidCode("Mental"));
        }

        [Fact]
        public void IsValidCode_WithNull_ReturnsFalse()
        {
            Assert.False(TrainingType.IsValidCode(null));
        }

        [Fact]
        public void IsValidCode_IsCaseSensitive()
        {
            Assert.False(TrainingType.IsValidCode("fisico"));
        }
    }
}
