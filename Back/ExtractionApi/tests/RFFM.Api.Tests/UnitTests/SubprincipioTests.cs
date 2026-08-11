#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SubprincipioTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var sp = new Subprincipio("principle-1", "defensa-organizada-1.1", "1.1", "Titulo", "Texto");

            Assert.Equal("principle-1", sp.GamePrincipleId);
            Assert.Equal("defensa-organizada-1.1", sp.Key);
            Assert.Equal("1.1", sp.Numero);
            Assert.Equal("Titulo", sp.Titulo);
            Assert.Equal("Texto", sp.Texto);
            Assert.Empty(sp.Zonas);
            Assert.Empty(sp.SubSubPrincipios);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyKey_Throws(string? key)
        {
            Assert.Throws<ArgumentException>(() => new Subprincipio("principle-1", key!, "1.1", "Titulo", "Texto"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTitulo_Throws(string? titulo)
        {
            Assert.Throws<ArgumentException>(() => new Subprincipio("principle-1", "key-1", "1.1", titulo!, "Texto"));
        }
    }
}
