using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RoundSimulationPolicyTests
    {
        private static readonly DateOnly Today = new(2026, 10, 22);

        private static SimMatch M(int round, int? localGoals = null, int? visitorGoals = null, DateOnly? date = null) =>
            new(round, "A", "B", localGoals, visitorGoals, date);

        [Fact]
        public void Una_jornada_con_todos_los_resultados_esta_jugada()
        {
            Assert.Equal(RoundStatus.Played, RoundSimulationPolicy.Status([M(1, 1, 0), M(1, 2, 2)], Today));
        }

        [Fact]
        public void Una_jornada_con_algun_resultado_esta_en_juego()
        {
            Assert.Equal(RoundStatus.InProgress, RoundSimulationPolicy.Status([M(1, 1, 0), M(1)], Today));
        }

        [Fact]
        public void Una_jornada_cuya_fecha_ha_llegado_esta_en_juego()
        {
            Assert.Equal(RoundStatus.InProgress,
                RoundSimulationPolicy.Status([M(1, date: Today), M(1, date: Today.AddDays(1))], Today));
        }

        [Fact]
        public void Una_jornada_futura_o_sin_fechas_esta_por_jugar()
        {
            Assert.Equal(RoundStatus.Upcoming, RoundSimulationPolicy.Status([M(1, date: Today.AddDays(3))], Today));
            Assert.Equal(RoundStatus.Upcoming, RoundSimulationPolicy.Status([M(1)], Today));
        }

        [Fact]
        public void Simula_hasta_la_primera_jornada_por_jugar_incluida()
        {
            var calendar = new[] { M(1, 1, 0), M(2, 0, 0), M(3, date: Today.AddDays(3)), M(4, date: Today.AddDays(10)) };

            Assert.Equal([1, 2, 3], RoundSimulationPolicy.RoundsToSimulate(calendar, Today));
        }

        [Fact]
        public void Si_todas_las_jornadas_han_empezado_las_simula_todas()
        {
            var calendar = new[] { M(2, 1, 0), M(1, 0, 0) };

            Assert.Equal([1, 2], RoundSimulationPolicy.RoundsToSimulate(calendar, Today));
        }

        [Theory]
        [InlineData(0.5, 0.3, 0.2, MatchOutcomeKind.Home)]
        [InlineData(0.2, 0.3, 0.5, MatchOutcomeKind.Away)]
        [InlineData(0.3, 0.4, 0.3, MatchOutcomeKind.Draw)]
        [InlineData(0.4, 0.4, 0.2, MatchOutcomeKind.Draw)]
        [InlineData(0.4, 0.2, 0.4, MatchOutcomeKind.Home)]
        public void El_resultado_predicho_es_el_mas_probable(double home, double draw, double away, MatchOutcomeKind expected)
        {
            Assert.Equal(expected, RoundSimulationPolicy.PredictedOutcome(new MatchOutcome(home, draw, away, 0, 0)));
        }

        [Theory]
        [InlineData(2, 1, MatchOutcomeKind.Home)]
        [InlineData(1, 1, MatchOutcomeKind.Draw)]
        [InlineData(0, 3, MatchOutcomeKind.Away)]
        public void El_resultado_real_sale_del_marcador(int localGoals, int visitorGoals, MatchOutcomeKind expected)
        {
            Assert.Equal(expected, RoundSimulationPolicy.ActualOutcome(localGoals, visitorGoals));
        }
    }
}
