using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamRatingsCalculatorTests
    {
        private static SimMatch M(int round, string local, string visitor, int? localGoals, int? visitorGoals) =>
            new(round, local, visitor, localGoals, visitorGoals, null);

        private static Dictionary<string, double> Neutral(params string[] codes) => codes.ToDictionary(c => c, _ => 1d);

        [Fact]
        public void Sin_partidos_el_ataque_es_la_fuerza_y_la_defensa_su_inversa()
        {
            var ratings = TeamRatingsCalculator.Calculate(["A", "B"], [M(1, "A", "B", null, null)],
                new Dictionary<string, double> { ["A"] = 1.25, ["B"] = 0.8 });

            Assert.Equal(1.25, ratings.Teams["A"].Attack, 6);
            Assert.Equal(0.8, ratings.Teams["A"].Defense, 6);
        }

        [Fact]
        public void Sin_partidos_las_medias_de_liga_son_las_de_por_defecto()
        {
            var ratings = TeamRatingsCalculator.Calculate(["A", "B"], [], Neutral("A", "B"));

            Assert.Equal((TeamRatingsCalculator.DefaultHomeGoals, TeamRatingsCalculator.DefaultAwayGoals),
                (ratings.MuHome, ratings.MuAway));
        }

        [Fact]
        public void Con_pocos_partidos_las_medias_de_liga_se_acercan_a_las_de_por_defecto()
        {
            var ratings = TeamRatingsCalculator.Calculate(["A", "B"], [M(1, "A", "B", 6, 0)], Neutral("A", "B"));

            // (6 + 10·1.5) / 11 = 1.909
            Assert.Equal(21d / 11d, ratings.MuHome, 6);
        }

        [Fact]
        public void Veinte_victorias_pesan_mas_que_una_plantilla_debil()
        {
            var calendar = Enumerable.Range(1, 20)
                .Select(r => r % 2 == 0 ? M(r, "A", "B", 4, 0) : M(r, "B", "A", 0, 4))
                .ToList();

            var ratings = TeamRatingsCalculator.Calculate(["A", "B"], calendar,
                new Dictionary<string, double> { ["A"] = 0.6, ["B"] = 1.6 });

            Assert.True(ratings.Teams["A"].Attack > 1);
            Assert.True(ratings.Teams["A"].Defense < 1);
        }

        [Fact]
        public void Los_goles_esperados_quedan_acotados()
        {
            var calendar = Enumerable.Range(1, 60)
                .Select(r => r % 2 == 0 ? M(r, "A", "B", 25, 0) : M(r, "B", "A", 0, 25))
                .Append(M(61, "C", "D", 0, 0))
                .ToList();

            var ratings = TeamRatingsCalculator.Calculate(["A", "B", "C", "D"], calendar, Neutral("A", "B", "C", "D"));

            var (strongLocal, weakVisitor) = ratings.ExpectedGoals("A", "B");
            Assert.Equal(TeamRatingsCalculator.MaxExpectedGoals, strongLocal);
            Assert.Equal(TeamRatingsCalculator.MinExpectedGoals, weakVisitor);
        }

        [Fact]
        public void El_local_espera_mas_goles_entre_equipos_iguales()
        {
            var ratings = TeamRatingsCalculator.Calculate(["A", "B"], [], Neutral("A", "B"));

            var (local, visitor) = ratings.ExpectedGoals("A", "B");
            Assert.True(local > visitor);
        }
    }
}
