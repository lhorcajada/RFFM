#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.GameModels;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GamePrincipleTests
    {
        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var principle = new GamePrinciple("game-model-1", gameMomentId: 1, key: "defensa-organizada-1", numero: 1, "Principio 1", "Texto");

            Assert.Equal("game-model-1", principle.GameModelId);
            Assert.Equal(1, principle.GameMomentId);
            Assert.Equal("defensa-organizada-1", principle.Key);
            Assert.Equal(1, principle.Numero);
            Assert.Equal("Principio 1", principle.Titulo);
            Assert.Equal("Texto", principle.Texto);
            Assert.Empty(principle.Subprincipios);
        }

        [Fact]
        public void Create_WithNullTexto_DefaultsToEmptyString()
        {
            var principle = new GamePrinciple("game-model-1", 1, "key-1", 1, "Principio 1", null!);

            Assert.Equal(string.Empty, principle.Texto);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTitulo_Throws(string? titulo)
        {
            Assert.Throws<ArgumentException>(() => new GamePrinciple("game-model-1", 1, "key-1", 1, titulo!, "Texto"));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyKey_Throws(string? key)
        {
            Assert.Throws<ArgumentException>(() => new GamePrinciple("game-model-1", 1, key!, 1, "Principio 1", "Texto"));
        }

        [Fact]
        public void UpdateTitulo_WithValidValue_TrimsAndSets()
        {
            var principle = new GamePrinciple("game-model-1", 1, "key-1", 1, "Principio 1", "Texto");

            principle.UpdateTitulo("  Nuevo titulo  ");

            Assert.Equal("Nuevo titulo", principle.Titulo);
        }

        [Fact]
        public void UpdateTexto_SetsNewValue()
        {
            var principle = new GamePrinciple("game-model-1", 1, "key-1", 1, "Principio 1", "Texto");

            principle.UpdateTexto("Nuevo texto");

            Assert.Equal("Nuevo texto", principle.Texto);
        }
    }
}
