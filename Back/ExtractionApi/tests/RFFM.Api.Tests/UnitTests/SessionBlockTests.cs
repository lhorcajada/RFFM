#nullable enable
using RFFM.Api.Domain.Aggregates.Training;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SessionBlockTests
    {
        [Fact]
        public void Create_WithRequiredFields_SetsProperties()
        {
            var block = new SessionBlock("session-1", 1, "Bloque 1 - Calentamiento",
                "Primer bloque de la sesion.", rotacionEntreEjercicios: null);

            Assert.Equal("session-1", block.TrainingSessionId);
            Assert.Equal(1, block.Order);
            Assert.Equal("Bloque 1 - Calentamiento", block.Nombre);
            Assert.Equal("Primer bloque de la sesion.", block.ComoConectaConAnterior);
            Assert.Null(block.RotacionEntreEjercicios);
            Assert.Empty(block.Exercises);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyComoConectaConAnterior_Throws(string? comoConecta)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new SessionBlock("session-1", 1, "Bloque 1", comoConecta!, null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyNombre_Throws(string? nombre)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new SessionBlock("session-1", 1, nombre!, "conecta", null));
        }

        [Fact]
        public void ReplaceExercises_ClearsAndRebuilds()
        {
            var block = new SessionBlock("session-1", 1, "Bloque 1", "conecta", null);
            block.ReplaceExercises(new[] { ("ex-1", 1), ("ex-2", 2) });

            Assert.Equal(2, block.Exercises.Count);
            Assert.Contains(block.Exercises, e => e.TaskTrainingBaseId == "ex-1" && e.Position == 1);

            block.ReplaceExercises(new[] { ("ex-3", 1) });
            Assert.Single(block.Exercises);
        }
    }

    public class SessionBlockExerciseTests
    {
        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyExerciseId_Throws(string? exerciseId)
        {
            Assert.Throws<System.ArgumentException>(() =>
                new SessionBlockExercise("block-1", exerciseId!, 1));
        }
    }
}
