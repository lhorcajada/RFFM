using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SeasonSimulatorTests
    {
        private const int Iterations = 2_000;
        private static readonly string[] Codes = ["A", "B", "C", "D"];

        private static SimMatch M(int round, string local, string visitor, int? localGoals = null, int? visitorGoals = null) =>
            new(round, local, visitor, localGoals, visitorGoals, null);

        /// <summary>Doble vuelta entre A, B, C y D: 6 jornadas; las primeras <paramref name="playedRounds"/> con resultado.</summary>
        private static List<SimMatch> DoubleRoundRobin(int playedRounds, Func<string, string, (int, int)>? score = null)
        {
            (string, string)[][] firstLeg = [[("A", "B"), ("C", "D")], [("A", "C"), ("B", "D")], [("A", "D"), ("B", "C")]];
            var rounds = firstLeg.Concat(firstLeg.Select(r => r.Select(p => (p.Item2, p.Item1)).ToArray())).ToList();
            score ??= (_, _) => (1, 1);

            return rounds.SelectMany((pairs, index) => pairs.Select(p =>
            {
                var round = index + 1;
                if (round > playedRounds) return M(round, p.Item1, p.Item2);
                var (l, v) = score(p.Item1, p.Item2);
                return M(round, p.Item1, p.Item2, l, v);
            })).ToList();
        }

        private static SimulationInput Input(IReadOnlyList<SimMatch> calendar, IReadOnlyDictionary<string, int>? sanctions = null) => new(
            Codes.Select(c => new SimTeam(c, $"Equipo {c}", null)).ToList(),
            calendar,
            new Dictionary<string, IReadOnlyList<SimPlayer>>(),
            RffmPointsSystem.Default,
            sanctions ?? new Dictionary<string, int>());

        private static ProjectedStanding Standing(SimulationResult result, string code) =>
            result.Standings.Single(s => s.TeamCode == code);

        [Fact]
        public void Las_probabilidades_por_equipo_y_por_puesto_suman_uno()
        {
            var result = SeasonSimulator.Run(Input(DoubleRoundRobin(3)), Iterations);

            Assert.All(result.Standings, s => Assert.Equal(1, s.PositionProbabilities.Sum(), 3));
            for (var position = 0; position < Codes.Length; position++)
                Assert.Equal(1, result.Standings.Sum(s => s.PositionProbabilities[position]), 3);
        }

        [Fact]
        public void Los_puntos_esperados_nunca_son_menores_que_los_actuales()
        {
            var result = SeasonSimulator.Run(Input(DoubleRoundRobin(3)), Iterations);

            Assert.All(result.Standings, s => Assert.True(s.ExpectedPoints >= s.CurrentPoints));
        }

        [Fact]
        public void Sin_partidos_pendientes_cada_equipo_termina_en_su_puesto_actual()
        {
            var calendar = DoubleRoundRobin(6, (local, visitor) => local == "A" ? (3, 0) : visitor == "A" ? (0, 3) : (1, 1));

            var result = SeasonSimulator.Run(Input(calendar), Iterations);

            Assert.Equal(0, result.PendingMatches);
            Assert.Empty(result.Predictions);
            var a = Standing(result, "A");
            Assert.Equal((1, 18, 18d, 1d), (a.CurrentPosition, a.CurrentPoints, a.ExpectedPoints, a.ChampionProbability));
            Assert.All(result.Standings, s => Assert.Equal(1d, s.PositionProbabilities[s.CurrentPosition - 1]));
        }

        [Fact]
        public void Descuenta_los_puntos_de_sancion()
        {
            var result = SeasonSimulator.Run(Input(DoubleRoundRobin(1), new Dictionary<string, int> { ["A"] = 3 }), Iterations);

            // Jornada 1: A-B 1-1 → 1 punto, menos 3 de sanción.
            Assert.Equal(-2, Standing(result, "A").CurrentPoints);
        }

        [Fact]
        public void Con_los_mismos_datos_da_el_mismo_resultado()
        {
            var input = Input(DoubleRoundRobin(2, (l, _) => l == "A" ? (2, 0) : (0, 1)));

            var first = SeasonSimulator.Run(input, Iterations);
            var second = SeasonSimulator.Run(input, Iterations);

            Assert.Equal(first.Standings.Select(s => (s.TeamCode, s.ExpectedPoints)), second.Standings.Select(s => (s.TeamCode, s.ExpectedPoints)));
        }

        [Fact]
        public void Solo_predice_los_partidos_pendientes_ordenados_por_jornada()
        {
            var calendar = DoubleRoundRobin(4);
            calendar.Reverse();

            var result = SeasonSimulator.Run(Input(calendar), Iterations);

            Assert.Equal((8, 4), (result.PlayedMatches, result.PendingMatches));
            Assert.Equal([5, 5, 6, 6], result.Predictions.Select(p => p.Match.Round));
        }

        [Fact]
        public void El_equipo_que_lo_gana_todo_es_favorito_en_casa_y_al_titulo()
        {
            var calendar = DoubleRoundRobin(3, (local, visitor) => local == "A" ? (4, 0) : visitor == "A" ? (0, 4) : (1, 1));

            var result = SeasonSimulator.Run(Input(calendar), Iterations);

            var prediction = result.Predictions.First(p => p.Match.LocalCode == "B" && p.Match.VisitorCode == "A");
            Assert.True(prediction.Outcome.Away > prediction.Outcome.Home);
            Assert.Equal("A", result.Standings[0].TeamCode);
            Assert.True(Standing(result, "A").ChampionProbability > 0.9);
        }

        [Fact]
        public void Un_visitante_con_plantilla_de_mas_nivel_es_favorito_antes_de_empezar_la_liga()
        {
            static SimPlayer Player(string competition, int position) =>
                new(0, 0, 0, true, 20, 10, 15, 2, [new SimPlayerParticipation(competition, $"{competition} grupo", position)]);
            var squads = new Dictionary<string, IReadOnlyList<SimPlayer>>
            {
                ["A"] = Enumerable.Range(0, 13).Select(_ => Player("SEGUNDA INFANTIL", 4))
                    .Concat(Enumerable.Range(0, 9).Select(_ => Player("PRIMERA INFANTIL", 8))).ToList(),
                ["B"] = Enumerable.Range(0, 18).Select(_ => Player("PRIMERA INFANTIL", 3)).ToList()
            };
            var input = new SimulationInput([new SimTeam("A", "Equipo A", null), new SimTeam("B", "Equipo B", null)],
                [M(1, "A", "B"), M(2, "B", "A")], squads, RffmPointsSystem.Default, new Dictionary<string, int>());

            var result = SeasonSimulator.Run(input, Iterations);

            var first = result.Predictions.Single(p => p.Match.Round == 1);
            Assert.True(first.Outcome.Away > first.Outcome.Home);
        }

        [Fact]
        public void Ordena_la_clasificacion_proyectada_por_puntos_esperados()
        {
            var calendar = DoubleRoundRobin(3, (local, visitor) => local == "A" ? (4, 0) : visitor == "A" ? (0, 4) : (1, 1));

            var result = SeasonSimulator.Run(Input(calendar), Iterations);

            Assert.Equal(result.Standings.OrderByDescending(s => s.ExpectedPoints).Select(s => s.TeamCode),
                result.Standings.Select(s => s.TeamCode));
        }
    }
}
