#nullable enable
using System.Collections.Generic;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TaskTrainingBaseNivelesTests
    {
        private static TaskTrainingBase NewExercise() => new()
        {
            Name = "Ejercicio",
            Tipo = "Analitico",
            Objetivo = "Objetivo",
            Logistica = "Logistica",
            Descripcion = "Descripcion",
            ClubId = "club-1",
        };

        private static List<ExerciseLevelRow> Rows(params (int Nivel, Dictionary<string, string> Valores)[] rows)
        {
            var list = new List<ExerciseLevelRow>();
            foreach (var (nivel, valores) in rows)
                list.Add(new ExerciseLevelRow(nivel, valores));
            return list;
        }

        [Fact]
        public void UpdateNiveles_WithTwoValidRows_Succeeds()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows(
                (1, new Dictionary<string, string> { ["Porterias"] = "2" }),
                (2, new Dictionary<string, string> { ["Porterias"] = "3" }));

            exercise.UpdateNiveles(columnas, niveles);

            Assert.Equal(2, exercise.Niveles.Count);
            Assert.Equal(columnas, exercise.NivelesColumnas);
        }

        [Fact]
        public void UpdateNiveles_WithOneRow_Throws()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows((1, new Dictionary<string, string> { ["Porterias"] = "2" }));

            Assert.Throws<System.ArgumentException>(() => exercise.UpdateNiveles(columnas, niveles));
        }

        [Fact]
        public void UpdateNiveles_WithSixRows_Throws()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows(
                (1, new()), (2, new()), (3, new()), (4, new()), (5, new()), (6, new()));

            Assert.Throws<System.ArgumentException>(() => exercise.UpdateNiveles(columnas, niveles));
        }

        [Fact]
        public void UpdateNiveles_WithGapInNumbering_Throws()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows((1, new()), (3, new()));

            Assert.Throws<System.ArgumentException>(() => exercise.UpdateNiveles(columnas, niveles));
        }

        [Fact]
        public void UpdateNiveles_WithDuplicateNivel_Throws()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows((1, new()), (1, new()));

            Assert.Throws<System.ArgumentException>(() => exercise.UpdateNiveles(columnas, niveles));
        }

        [Fact]
        public void UpdateNiveles_WithOrphanCell_Throws()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "Porterias" };
            var niveles = Rows(
                (1, new Dictionary<string, string> { ["NoExiste"] = "x" }),
                (2, new Dictionary<string, string>()));

            Assert.Throws<System.ArgumentException>(() => exercise.UpdateNiveles(columnas, niveles));
        }

        [Fact]
        public void UpdateNiveles_WithFiveRows_Succeeds()
        {
            var exercise = NewExercise();
            var columnas = new List<string> { "A", "B" };
            var niveles = Rows(
                (1, new()), (2, new()), (3, new()), (4, new()), (5, new()));

            exercise.UpdateNiveles(columnas, niveles);

            Assert.Equal(5, exercise.Niveles.Count);
        }
    }
}
