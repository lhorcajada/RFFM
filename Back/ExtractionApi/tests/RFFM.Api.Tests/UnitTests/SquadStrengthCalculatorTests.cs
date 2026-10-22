using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadStrengthCalculatorTests
    {
        private const string PrimeraInfantil = "PRIMERA INFANTIL";
        private const string SegundaInfantil = "SEGUNDA INFANTIL";
        private const string SegundaCadete = "SEGUNDA CADETE";

        private static SimPlayer Veteran(int previousPosition, string competition = PrimeraInfantil, string group = "Grupo 1",
            int previousCalled = 20, int previousStarter = 10, int previousPlayed = 15, int previousGoals = 2,
            int currentStarter = 0, int currentSubstitute = 0) =>
            new(currentStarter + currentSubstitute, currentStarter, currentSubstitute,
                true, previousCalled, previousStarter, previousPlayed, previousGoals,
                [new SimPlayerParticipation(competition, group, previousPosition)]);

        private static SimPlayer WithParticipations(params SimPlayerParticipation[] participations) =>
            new(0, 0, 0, true, 20, 10, 15, 2, participations);

        private static SimPlayer Newcomer(int currentStarter = 0, int currentSubstitute = 0) =>
            new(currentStarter + currentSubstitute, currentStarter, currentSubstitute, false, 0, 0, 0, 0, []);

        private static IReadOnlyList<SimPlayer> Many(int count, Func<SimPlayer> player) =>
            Enumerable.Range(0, count).Select(_ => player()).ToList();

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
        public void Un_octavo_de_primera_vale_mas_que_un_cuarto_de_segunda()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(8, PrimeraInfantil), Veteran(8, PrimeraInfantil)],
                ["B"] = [Veteran(4, SegundaInfantil), Veteran(4, SegundaInfantil)]
            });

            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public void Haber_jugado_en_una_categoria_de_edad_superior_cuenta()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(9, SegundaCadete)],
                ["B"] = [Veteran(9, SegundaInfantil)]
            });

            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public void Ser_titular_en_segunda_no_compensa_ser_suplente_en_primera()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(4, SegundaInfantil, previousCalled: 20, previousStarter: 20, previousGoals: 15)],
                ["B"] = [Veteran(4, PrimeraInfantil, previousCalled: 20, previousStarter: 0, previousGoals: 0)]
            });

            Assert.True(strength["B"] > strength["A"]);
        }

        [Fact]
        public void Caso_real_de_la_jornada_1_el_rival_de_primera_es_claramente_mas_fuerte()
        {
            var rival = Many(14, () => Veteran(3, PrimeraInfantil, "Grupo 10"))
                .Concat(Many(4, () => Veteran(13, PrimeraInfantil, "Grupo 8")))
                .Concat(Many(3, () => Veteran(9, SegundaCadete, "Grupo 25")))
                .ToList();
            var own = Many(13, () => Veteran(4, SegundaInfantil, "Grupo 14"))
                .Concat(Many(9, () => Veteran(8, PrimeraInfantil, "Grupo 11")))
                .ToList();

            var strength = Calculate(new() { ["RIVAL"] = rival, ["OWN"] = own });

            Assert.True(strength["RIVAL"] / strength["OWN"] > 1.3);
        }

        [Fact]
        public void Con_varias_participaciones_pesa_sobre_todo_la_mejor()
        {
            var strength = Calculate(new()
            {
                ["A"] = [WithParticipations(new SimPlayerParticipation(PrimeraInfantil, "Grupo 1", 8),
                    new SimPlayerParticipation("PRIMERA CADETE", "Grupo 2", 15))],
                ["B"] = [WithParticipations(new SimPlayerParticipation(PrimeraInfantil, "Grupo 1", 8))]
            });

            Assert.True(strength["A"] > strength["B"]);
        }

        [Fact]
        public void Una_participacion_sin_division_reconocible_cuenta_como_jugador_nuevo()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(5), Veteran(6)],
                ["B"] = [WithParticipations(new SimPlayerParticipation("COPA PRIMAVERA", "Grupo 1", 1))],
                ["C"] = [Newcomer()]
            });

            Assert.Equal(strength["C"], strength["B"], 9);
            Assert.True(strength["B"] < strength["A"]);
        }

        [Fact]
        public void Un_equipo_de_jugadores_nuevos_queda_algo_por_debajo_de_la_media()
        {
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(8), Veteran(9)],
                ["B"] = [Veteran(8), Veteran(9)],
                ["C"] = [Newcomer(), Newcomer()]
            });

            Assert.InRange(strength["C"], 0.85, 0.999);
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
                ["A"] = [Veteran(1, "SUPERLIGA JUVENIL")],
                ["B"] = [Veteran(16, SegundaInfantil)],
                ["C"] = [Veteran(16, SegundaInfantil)],
                ["D"] = [Veteran(16, SegundaInfantil)]
            });

            Assert.Equal(SquadStrengthCalculator.MaxStrength, strength["A"]);
            Assert.Equal(SquadStrengthCalculator.MinStrength, strength["B"]);
        }

        [Fact]
        public void Supone_grupos_de_al_menos_dieciseis_equipos()
        {
            // Con solo un 1º y un 4º vistos, el grupo cuenta como de 16: el 4º está cerca de la cabeza.
            var strength = Calculate(new()
            {
                ["A"] = [Veteran(1)],
                ["B"] = [Veteran(4)]
            });

            Assert.True(strength["A"] > strength["B"]);
            Assert.True(strength["B"] > 0.92);
        }
    }
}
