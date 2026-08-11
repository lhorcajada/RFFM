#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SubSubPrincipioTests
    {
        [Fact]
        public void Create_WithSubprincipioIdOnly_SetsProperties()
        {
            var ssp = new SubSubPrincipio("key-1", "1.1.1", "Delantero", "Texto", subprincipioId: "sp-1", zonaId: null);

            Assert.Equal("sp-1", ssp.SubprincipioId);
            Assert.Null(ssp.ZonaId);
            Assert.Equal("key-1", ssp.Key);
            Assert.Equal("1.1.1", ssp.Numero);
            Assert.Equal("Delantero", ssp.Rol);
            Assert.Equal("Texto", ssp.Texto);
            Assert.Empty(ssp.Habilidades);
        }

        [Fact]
        public void Create_WithZonaIdOnly_SetsProperties()
        {
            var ssp = new SubSubPrincipio("key-1", "1.1.1", "Delantero", "Texto", subprincipioId: null, zonaId: "zona-1");

            Assert.Null(ssp.SubprincipioId);
            Assert.Equal("zona-1", ssp.ZonaId);
        }

        [Fact]
        public void Create_WithBothParentsSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new SubSubPrincipio("key-1", "1.1.1", "Delantero", "Texto", subprincipioId: "sp-1", zonaId: "zona-1"));
        }

        [Fact]
        public void Create_WithNeitherParentSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new SubSubPrincipio("key-1", "1.1.1", "Delantero", "Texto", subprincipioId: null, zonaId: null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyRol_Throws(string? rol)
        {
            Assert.Throws<ArgumentException>(() =>
                new SubSubPrincipio("key-1", "1.1.1", rol!, "Texto", subprincipioId: "sp-1", zonaId: null));
        }
    }
}
