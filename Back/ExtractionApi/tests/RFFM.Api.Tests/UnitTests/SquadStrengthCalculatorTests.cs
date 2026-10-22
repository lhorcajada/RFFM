using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadStrengthCalculatorTests
    {
        private const string Group = "Grupo 1";

        private static SimPlayer Veteran(int previousPosition, int previousCalled = 20, int previousStarter = 10,
            int previousPlayed = 15, int previousGoals = 2, int currentStarter = 0, int currentSubstitute = 0) =>
            new(currentStarter + currentSubstitute, currentStarter, currentSubstitute,
                true, previousCalled, previousStarter, previousPlayed, previousGoals,
                [new SimPlayerParticipation("Liga", Group, previousPosition)]);

        private static SimPlayer Newcomer(int currentStarter = 0, int currentSubstitute = 0) =>
            new(currentStarter + currentSubstitute, currentStarter, currentSubstitute, false, 0, 0, 0, 0, []);

        private static IReadOnlyDictionary<string, double> Calculate(Dictionary<string, IReadOnlyList<SimPlayer>> squads,
            params string[] extraTeams) =>
            SquadStrengthCalculator.Calculate(squads.Keys.Concat(extraTeams).ToList(), squads);

        [Fact]
        public void Da_mas_fuerza_al_equipo_cuyos_jugadores_quedaron_mas_arriba()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(1), Veteran(2)],
                ["B"] = [Veteran(15), Veteran(16)]
            });

            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public void Un_equipo_de_jugadores_nuevos_queda_ligeramente_por_debajo_de_la_media()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(8), Veteran(9)],
                ["B"] = [Veteran(8), Veteran(9)],
                ["C"] = [Newcomer(), Newcomer()]
            });

            Assert.InRange(strength["C"], 0.9, 0.999);
        }

        [Fact]
        public void Sin_plantillas_todos_los_equipos_tienen_fuerza_uno()
        {
            var strength = SquadStrengthCalculator.Calculate(["A", "B"], new Dictionary<string, IReadOnlyList<SimPlayer>>());

            Assert.Equal((1d, 1d), (strength["A"], strength["B"]));
        }

        [Fact]
        public void Un_equipo_sin_plantilla_tiene_fuerza_uno_aunque_otros_la_tengan()
        {
            var strength = Calculate(new() { ["A"] = [Veteran(1)], ["B"] = [Veteran(10)] }, "C");

            Assert.Equal(1d, strength["C"]);
        }

        [Fact]
        public void Un_titular_habitual_pesa_mas_que_un_jugador_sin_minutos()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(1, currentStarter: 10), Veteran(16)],
                ["B"] = [Veteran(1), Veteran(16, currentStarter: 10)]
            });

            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public void La_fuerza_queda_acotada()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(1, previousStarter: 20, previousGoals: 30)],
                ["B"] = [Veteran(16, previousStarter: 0, previousGoals: 0)],
                ["C"] = [Veteran(16, previousStarter: 0, previousGoals: 0)],
                ["D"] = [Veteran(16, previousStarter: 0, previousGoals: 0)]
            });

            Assert.True(strength.Values.All(s => s is >= SquadStrengthCalculator.MinStrength and <= SquadStrengthCalculator.MaxStrength));
            Assert.Equal(SquadStrengthCalculator.MaxStrength, strength["A"]);
        }

        [Fact]
        public void Estima_el_tamano_del_grupo_con_un_minimo_de_diez_equipos()
        {
            // Con solo un 1º y un 3º vistos, el grupo se estima en 10 equipos: el 3º no cuenta como el último.
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(1)],
                ["B"] = [Veteran(3)]
            });

            Assert.True(strength["A"] > strength["B"]);
            Assert.True(strength["B"] > 0.8);
        }
    }
}
