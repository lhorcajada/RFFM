#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class ZonaTests
    {
        [Fact]
        public void Create_WithSingleZoneKey_SetsProperties()
        {
            var zona = new Zona("subprincipio-1", "defensa-organizada-1.1-finalizacion", "finalizacion", null, null, "Texto");

            Assert.Equal("subprincipio-1", zona.SubprincipioId);
            Assert.Equal("defensa-organizada-1.1-finalizacion", zona.Key);
            Assert.Equal("finalizacion", zona.ZoneKeysCsv);
            Assert.Null(zona.Label);
            Assert.Null(zona.ZonaTexto);
            Assert.Equal("Texto", zona.Texto);
            Assert.Empty(zona.SubSubPrincipios);
        }

        [Fact]
        public void Create_WithMultipleZoneKeys_SetsCsv()
        {
            var zona = new Zona("subprincipio-1", "key-1", "creacion-propia,iniciacion", null, null, "Texto");

            Assert.Equal("creacion-propia,iniciacion", zona.ZoneKeysCsv);
        }

        [Fact]
        public void Create_WithCompuesta_RequiresZonaTexto()
        {
            var zona = new Zona("subprincipio-1", "key-1", "compuesta", null, "Balon cae entre zonas", "Texto");

            Assert.Equal("compuesta", zona.ZoneKeysCsv);
            Assert.Equal("Balon cae entre zonas", zona.ZonaTexto);
        }

        [Fact]
        public void Create_WithCompuestaAndNoZonaTexto_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Zona("subprincipio-1", "key-1", "compuesta", null, null, "Texto"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyZoneKeysCsv_Throws(string? zoneKeys)
        {
            Assert.Throws<ArgumentException>(() => new Zona("subprincipio-1", "key-1", zoneKeys!, null, null, "Texto"));
        }

        [Fact]
        public void Create_WithUnknownZoneKey_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Zona("subprincipio-1", "key-1", "no-existe", null, null, "Texto"));
        }

        [Fact]
        public void Create_WithLabel_SetsLabel()
        {
            var zona = new Zona("subprincipio-1", "key-1", "creacion-propia,creacion-rival", "Ataque del centro", null, "Texto");

            Assert.Equal("Ataque del centro", zona.Label);
        }
    }
}
