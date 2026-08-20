#nullable enable
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class HabilidadTests
    {
        [Theory]
        [InlineData("Perfilamiento")]
        [InlineData("Anticipación")]
        [InlineData("Activación")]
        [InlineData("Carga")]
        [InlineData("Temporización")]
        [InlineData("Comunicación")]
        [InlineData("Entrada")]
        [InlineData("Intercepción")]
        [InlineData("Conducción")]
        [InlineData("Protección de balón")]
        [InlineData("Control orientado")]
        [InlineData("Pase")]
        [InlineData("Centro")]
        [InlineData("Remate")]
        [InlineData("Remate de cabeza")]
        public void Create_WithVocabularyName_Succeeds(string nombre)
        {
            var habilidad = new Habilidad("ssp-1", nombre, "Descripcion", "Entrenable", null);

            Assert.Equal(nombre, habilidad.Nombre);
            Assert.Equal("ssp-1", habilidad.SubSubPrincipioId);
        }

        [Fact]
        public void Create_WithUnknownName_Throws()
        {
            Assert.Throws<ArgumentException>(() => new Habilidad("ssp-1", "Regate", "Descripcion", "Entrenable", null));
        }

        [Fact]
        public void Create_WithReferenciaAKey_SetsReference()
        {
            var habilidad = new Habilidad("ssp-1", "Anticipación", "", "", "defensa-organizada-1.1.6");

            Assert.Equal("defensa-organizada-1.1.6", habilidad.ReferenciaAKey);
        }
    }
}
