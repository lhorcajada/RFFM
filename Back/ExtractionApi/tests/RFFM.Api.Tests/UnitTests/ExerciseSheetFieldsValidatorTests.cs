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
            List<string>? secuencia = null,
            List<string>? reglas = null,
            List<string>? queSeVe = null,
            List<ExerciseTeamRequest>? jugadores = null) => new(
            "club-id", "Ejercicio", "Analitico", "Objetivo", null, "", null, null, null, "",
            new List<string>(), Levels(levelCount), null)
        {
            Espacio = espacio,
            TurnoMinutos = turnoMinutos,
            NivelDibujo = nivelDibujo,
            Secuencia = secuencia ?? new List<string>(),
            Reglas = reglas ?? new List<string>(),
            QueSeVe = queSeVe ?? new List<string>(),
            Jugadores = jugadores ?? new List<ExerciseTeamRequest>(),
        };

        private static ExerciseTeamRequest Team(
            string? color = "blue", string nombre = "Equipo", int? cantidad = 4, string? roles = null,
            List<string>? objetivos = null) =>
            new(color, nombre, cantidad, roles, objetivos ?? new List<string> { "Mantener la posesión" });

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
        public async Task Command_WithTooManyTeams_IsRejected()
        {
            var teams = Enumerable.Range(0, ExerciseSheetLimits.MaxTeams + 1).Select(_ => Team()).ToList();
            Assert.False(await IsValid(Command(jugadores: teams)));
        }

        [Fact]
        public async Task Command_WithMaxTeams_IsValid()
        {
            var teams = Enumerable.Range(0, ExerciseSheetLimits.MaxTeams).Select(_ => Team()).ToList();
            Assert.True(await IsValid(Command(jugadores: teams)));
        }

        [Fact]
        public async Task Command_WithTooManyLinesInSequence_IsRejected()
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Paso {i}").ToList();
            Assert.False(await IsValid(Command(secuencia: lines)));
        }

        [Fact]
        public async Task Command_WithTooManyLinesInRules_IsRejected()
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Regla {i}").ToList();
            Assert.False(await IsValid(Command(reglas: lines)));
        }

        [Fact]
        public async Task Command_WithTooManyLinesInQueSeVe_IsRejected()
        {
            var lines = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Se ve {i}").ToList();
            Assert.False(await IsValid(Command(queSeVe: lines)));
        }

        [Fact]
        public async Task Command_WithTooLongLine_IsRejected()
        {
            var lines = new List<string> { new('x', ExerciseSheetLimits.MaxLineLength + 1) };
            Assert.False(await IsValid(Command(secuencia: lines)));
        }

        [Fact]
        public async Task Command_WithMaxLengthLine_IsValid()
        {
            var lines = new List<string> { new('x', ExerciseSheetLimits.MaxLineLength) };
            Assert.True(await IsValid(Command(secuencia: lines)));
        }

        [Fact]
        public async Task Command_WithTooManyObjectivesInATeam_IsRejected()
        {
            var objetivos = Enumerable.Range(0, ExerciseSheetLimits.MaxLines + 1).Select(i => $"Obj {i}").ToList();
            Assert.False(await IsValid(Command(jugadores: new List<ExerciseTeamRequest> { Team(objetivos: objetivos) })));
        }

        [Fact]
        public async Task Command_WithTooLongTeamName_IsRejected()
        {
            var name = new string('x', ExerciseSheetLimits.MaxTeamNameLength + 1);
            Assert.False(await IsValid(Command(jugadores: new List<ExerciseTeamRequest> { Team(nombre: name) })));
        }

        [Fact]
        public async Task Command_WithColorOutsideThePalette_IsRejected()
        {
            Assert.False(await IsValid(Command(jugadores: new List<ExerciseTeamRequest> { Team(color: "purple") })));
        }

        [Theory]
        [InlineData("blue")]
        [InlineData("yellow")]
        [InlineData("gray")]
        [InlineData(null)]
        public async Task Command_WithPaletteColorOrNone_IsValid(string? color)
        {
            Assert.True(await IsValid(Command(jugadores: new List<ExerciseTeamRequest> { Team(color: color) })));
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
                "Ejercicio", "Analitico", "Objetivo", null, "", null, null, null, "",
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
            Assert.Empty(exercise.Secuencia);
            Assert.Empty(exercise.Reglas);
            Assert.Empty(exercise.QueSeVe);
            Assert.Empty(exercise.Jugadores);
        }
    }
}
