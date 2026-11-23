#nullable enable
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Features.Coaches.Trainings.Exercises;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>Caps on the structured sheet fields (E3) and the drawing level rule (E5). The
    /// validator never decides whether the content fits one printed sheet.</summary>
    public class ExerciseSheetFieldsValidatorTests
    {
        private static List<NivelRowRequest> Levels(int count) =>
            Enumerable.Range(1, count).Select(n => new NivelRowRequest(n, new Dictionary<string, string>())).ToList();

        private static CreateExerciseCommand Command(
            int levelCount = 2,
            string? espacio = null,
            int? turnoMinutos = null,
            int? nivelDibujo = null,
            List<string>? reglas = null,
            List<string>? puntos = null,
            List<string>? rotaciones = null,
            List<string>? montaje = null) => new(
            "club-id", "Ejercicio", "Analitico", "Objetivo", null, "", null, null, "",
            new List<string>(), Levels(levelCount), null)
        {
            Espacio = espacio,
            TurnoMinutos = turnoMinutos,
            NivelDibujo = nivelDibujo,
            Reglas = reglas ?? new List<string>(),
            Puntos = puntos ?? new List<string>(),
            Rotaciones = rotaciones ?? new List<string>(),
            Montaje = montaje ?? new List<string>(),
        };

        private static CreateExerciseCommand CommandWithList(string list, List<string> lines) => list switch
        {
            "puntos" => Command(puntos: lines),
            "rotaciones" => Command(rotaciones: lines),
            _ => Command(montaje: lines),
        };

        private static async Task<bool> IsValid(CreateExerciseCommand command) =>
            (await new CreateExerciseValidator().ValidateAsync(command)).IsValid;

        [Fact]
        public async Task Command_WithoutAnySheetField_IsValid()
        {
            Assert.True(await IsValid(Command()));
        }

        [Fact]
        public async Task Command_WithoutLogisticaNorDescripcion_IsValid()
        {
            var command = Command() with { Logistica = "", Descripcion = "" };
            Assert.True(await IsValid(command));
        }

        [Fact]
        public async Task Command_WithTooManyLinesInRules_IsRejected()
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Regla {i}").ToList();
            Assert.False(await IsValid(Command(reglas: lines)));
        }

        [Theory]
        [InlineData("puntos")]
        [InlineData("rotaciones")]
        [InlineData("montaje")]
        public async Task Command_WithTooManyLinesInANewList_IsRejected(string list)
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Línea {i}").ToList();
            Assert.False(await IsValid(CommandWithList(list, lines)));
        }

        [Theory]
        [InlineData("puntos")]
        [InlineData("rotaciones")]
        [InlineData("montaje")]
        public async Task Command_WithTooLongLineInANewList_IsRejected(string list)
        {
            var lines = new List<string> { new('x', ExerciseSheetLimits.MaxLineLength + 1) };
            Assert.False(await IsValid(CommandWithList(list, lines)));
        }

        [Theory]
        [InlineData("puntos")]
        [InlineData("rotaciones")]
        [InlineData("montaje")]
        public async Task Command_WithMaxLinesOfMaxLengthInANewList_IsValid(string list)
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines).Select(_ => new string('x', ExerciseSheetLimits.MaxLineLength)).ToList();
            Assert.True(await IsValid(CommandWithList(list, lines)));
        }

        [Fact]
        public async Task Command_WithTooLongLine_IsRejected()
        {
            var lines = new List<string> { new('x', ExerciseSheetLimits.MaxLineLength + 1) };
            Assert.False(await IsValid(Command(reglas: lines)));
        }

        [Fact]
        public async Task Command_WithMaxLengthLine_IsValid()
        {
            var lines = new List<string> { new('x', ExerciseSheetLimits.MaxLineLength) };
            Assert.True(await IsValid(Command(reglas: lines)));
        }

        [Fact]
        public async Task Command_WithTooLongEspacio_IsRejected()
        {
            Assert.False(await IsValid(Command(espacio: new string('x', ExerciseSheetLimits.MaxEspacioLength + 1))));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(ExerciseSheetLimits.MaxTurnoMinutos + 1)]
        public async Task Command_WithTurnoMinutosOutOfRange_IsRejected(int turno)
        {
            Assert.False(await IsValid(Command(turnoMinutos: turno)));
        }

        [Fact]
        public async Task Command_WithNivelDibujoWithinRows_IsValid()
        {
            Assert.True(await IsValid(Command(levelCount: 3, nivelDibujo: 3)));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(4)]
        public async Task Command_WithNivelDibujoOutsideRows_IsRejected(int nivelDibujo)
        {
            Assert.False(await IsValid(Command(levelCount: 3, nivelDibujo: nivelDibujo)));
        }

        [Fact]
        public async Task UpdateCommand_WithNivelDibujoOutsideRows_IsRejected()
        {
            var update = new UpdateExerciseCommand(
                "Ejercicio", "Analitico", "Objetivo", null, "", null, null, "",
                new List<string>(), Levels(2), null)
            { NivelDibujo = 3 };

            var result = await new UpdateExerciseValidator().ValidateAsync(update);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void TaskTrainingBase_NewExercise_StartsWithEmptySheetFields()
        {
            var exercise = new TaskTrainingBase();

            Assert.Null(exercise.Espacio);
            Assert.Null(exercise.TurnoMinutos);
            Assert.Null(exercise.NivelDibujo);
            Assert.Empty(exercise.Reglas);
            Assert.Empty(exercise.Puntos);
            Assert.Empty(exercise.Rotaciones);
            Assert.Empty(exercise.Montaje);
        }
    }
}
