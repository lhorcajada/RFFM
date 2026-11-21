using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class MatchProbabilitiesTests
    {
        [Theory]
        [InlineData(1.5, 1.2)]
        [InlineData(0.1, 8)]
        [InlineData(8, 8)]
        public void Las_tres_probabilidades_suman_uno(double local, double visitor)
        {
            var outcome = MatchProbabilities.Calculate(local, visitor);

            Assert.Equal(1, outcome.Home + outcome.Draw + outcome.Away, 6);
        }

        [Fact]
        public void Con_los_mismos_goles_esperados_local_y_visitante_tienen_la_misma_probabilidad()
        {
            var outcome = MatchProbabilities.Calculate(1.4, 1.4);

            Assert.Equal(outcome.Home, outcome.Away, 9);
        }

        [Fact]
        public void El_equipo_con_mas_goles_esperados_es_favorito()
        {
            var outcome = MatchProbabilities.Calculate(2.5, 0.8);

            Assert.True(outcome.Home > outcome.Away);
            Assert.True(outcome.Home > outcome.Draw);
        }

        [Fact]
        public void Con_muy_pocos_goles_esperados_el_marcador_mas_probable_es_cero_a_cero()
        {
            var outcome = MatchProbabilities.Calculate(0.1, 0.1);

            Assert.Equal((0, 0), (outcome.MostLikelyLocalGoals, outcome.MostLikelyVisitorGoals));
        }

        [Fact]
        public void El_marcador_mas_probable_sigue_a_los_goles_esperados()
        {
            var outcome = MatchProbabilities.Calculate(3.2, 0.4);

            Assert.Equal((3, 0), (outcome.MostLikelyLocalGoals, outcome.MostLikelyVisitorGoals));
        }

        [Fact]
        public void Si_el_local_es_el_resultado_favorito_el_marcador_mostrado_es_una_victoria_local()
        {
            var outcome = MatchProbabilities.Calculate(2.6, 2.0);

            Assert.True(outcome.Home > outcome.Draw && outcome.Home > outcome.Away);
            Assert.True(outcome.MostLikelyLocalGoals > outcome.MostLikelyVisitorGoals);
        }

        [Fact]
        public void Si_el_visitante_es_el_resultado_favorito_el_marcador_mostrado_es_una_victoria_visitante()
        {
            var outcome = MatchProbabilities.Calculate(2.0, 2.6);

            Assert.True(outcome.Away > outcome.Home && outcome.Away > outcome.Draw);
            Assert.True(outcome.MostLikelyVisitorGoals > outcome.MostLikelyLocalGoals);
        }

        [Fact]
        public void Si_el_empate_es_el_resultado_favorito_el_marcador_mostrado_es_un_empate()
        {
            var outcome = MatchProbabilities.Calculate(1.0, 1.0);

            Assert.True(outcome.Draw > outcome.Home && outcome.Draw > outcome.Away);
            Assert.Equal(outcome.MostLikelyLocalGoals, outcome.MostLikelyVisitorGoals);
        }
    }
}
