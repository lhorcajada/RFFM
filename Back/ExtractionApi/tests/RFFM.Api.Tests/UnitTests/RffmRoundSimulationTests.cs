using RFFM.Api.Domain.Entities.Federation.Results;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmRoundSimulationTests
    {
        private static readonly DateTime Now = new(2026, 10, 22, 8, 0, 0, DateTimeKind.Utc);

        private static RoundSimulationData Data(int played = 4, string matches = "[1]", string standings = "[2]") =>
            new(played, true, matches, standings);

        private static RffmRoundSimulation Open(int modelVersion = 1) =>
            RffmRoundSimulation.Create("123", 22, 3, Data(), modelVersion, isBackfilled: false, Now);

        private static RffmRoundSimulation Backfilled(int modelVersion = 1)
        {
            var simulation = RffmRoundSimulation.Create("123", 22, 1, Data(), modelVersion, isBackfilled: true, Now);
            simulation.Freeze(Now);
            return simulation;
        }

        [Fact]
        public void Crea_la_simulacion_de_una_jornada_abierta()
        {
            var simulation = RffmRoundSimulation.Create(" 123 ", 22, 3, Data(), 2, isBackfilled: false, Now);

            Assert.Equal(("123", 22, 3, 4, "[1]", "[2]", Now, 2, false), (simulation.GroupCode, simulation.SeasonId, simulation.Round,
                simulation.PlayedMatchesUsed, simulation.MatchesJson, simulation.StandingsJson, simulation.ComputedAt,
                simulation.ModelVersion, simulation.IsBackfilled));
            Assert.False(simulation.IsFrozen);
        }

        [Fact]
        public void Sin_grupo_no_se_puede_crear()
        {
            Assert.Throws<ArgumentException>(() => RffmRoundSimulation.Create(" ", 22, 3, Data(), 1, false, Now));
        }

        [Fact]
        public void Una_simulacion_abierta_se_reemplaza_con_la_version_nueva()
        {
            var simulation = Open();

            var replaced = simulation.Replace(Data(played: 6, matches: "[3]"), 2, Now.AddDays(1));

            Assert.True(replaced);
            Assert.Equal((6, "[3]", Now.AddDays(1), 2), (simulation.PlayedMatchesUsed, simulation.MatchesJson, simulation.ComputedAt,
                simulation.ModelVersion));
        }

        [Fact]
        public void Una_simulacion_congelada_no_se_reemplaza()
        {
            var simulation = Open();
            simulation.Freeze(Now.AddHours(1));

            var replaced = simulation.Replace(Data(matches: "[3]"), 2, Now.AddDays(1));

            Assert.False(replaced);
            Assert.Equal(("[1]", Now, 1), (simulation.MatchesJson, simulation.ComputedAt, simulation.ModelVersion));
        }

        [Fact]
        public void Congelar_dos_veces_conserva_la_primera_fecha()
        {
            var simulation = Open();

            simulation.Freeze(Now.AddHours(1));
            simulation.Freeze(Now.AddHours(2));

            Assert.Equal(Now.AddHours(1), simulation.FrozenAt);
        }

        [Fact]
        public void Una_rellenada_a_posteriori_se_recalcula_con_una_version_mayor_y_sigue_congelada()
        {
            var simulation = Backfilled(modelVersion: 1);

            var recomputed = simulation.RecomputeBackfilled(Data(matches: "[9]"), 2, Now.AddDays(1));

            Assert.True(recomputed);
            Assert.Equal(("[9]", 2, Now.AddDays(1), true), (simulation.MatchesJson, simulation.ModelVersion, simulation.ComputedAt,
                simulation.IsFrozen));
        }

        [Fact]
        public void Una_rellenada_a_posteriori_no_se_recalcula_con_la_misma_version()
        {
            var simulation = Backfilled(modelVersion: 2);

            Assert.False(simulation.RecomputeBackfilled(Data(matches: "[9]"), 2, Now.AddDays(1)));
            Assert.Equal("[1]", simulation.MatchesJson);
        }

        [Fact]
        public void Una_congelada_en_su_momento_nunca_se_recalcula()
        {
            var simulation = Open(modelVersion: 1);
            simulation.Freeze(Now);

            Assert.False(simulation.RecomputeBackfilled(Data(matches: "[9]"), 2, Now.AddDays(1)));
            Assert.Equal(("[1]", 1), (simulation.MatchesJson, simulation.ModelVersion));
        }
    }
}
