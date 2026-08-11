#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class NotaTests
    {
        [Fact]
        public void Create_AnchoredToPrincipio_SetsProperties()
        {
            var nota = new Nota("model-1", "nota", "Texto", principioId: "p-1", subprincipioId: null, zonaId: null, subSubPrincipioId: null);

            Assert.Equal("p-1", nota.PrincipioId);
            Assert.Null(nota.SubprincipioId);
            Assert.Null(nota.ZonaId);
            Assert.Null(nota.SubSubPrincipioId);
            Assert.Equal("nota", nota.Tipo);
        }

        [Theory]
        [InlineData("riesgo-aceptado")]
        [InlineData("objetivo-temporada")]
        [InlineData("nota")]
        [InlineData("excepcion")]
        public void Create_WithValidTipo_Succeeds(string tipo)
        {
            var nota = new Nota("model-1", tipo, "Texto", principioId: "p-1", subprincipioId: null, zonaId: null, subSubPrincipioId: null);
            Assert.Equal(tipo, nota.Tipo);
        }

        [Fact]
        public void Create_WithInvalidTipo_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new Nota("model-1", "otro", "Texto", principioId: "p-1", subprincipioId: null, zonaId: null, subSubPrincipioId: null));
        }

        [Fact]
        public void Create_WithNoAnchorSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new Nota("model-1", "nota", "Texto", principioId: null, subprincipioId: null, zonaId: null, subSubPrincipioId: null));
        }

        [Fact]
        public void Create_WithMultipleAnchorsSet_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                new Nota("model-1", "nota", "Texto", principioId: "p-1", subprincipioId: "sp-1", zonaId: null, subSubPrincipioId: null));
        }

        [Fact]
        public void Create_AnchoredToZona_SetsProperties()
        {
            var nota = new Nota("model-1", "riesgo-aceptado", "Texto", principioId: null, subprincipioId: null, zonaId: "z-1", subSubPrincipioId: null);
            Assert.Equal("z-1", nota.ZonaId);
        }

        [Fact]
        public void Create_AnchoredToSubSubPrincipio_SetsProperties()
        {
            var nota = new Nota("model-1", "excepcion", "Texto", principioId: null, subprincipioId: null, zonaId: null, subSubPrincipioId: "ssp-1");
            Assert.Equal("ssp-1", nota.SubSubPrincipioId);
        }
    }
}
