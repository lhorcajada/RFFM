using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SimulationAsOfTests
    {
        private static SimMatch M(int round, string local, string visitor, int? localGoals, int? visitorGoals) =>
            new(round, local, visitor, localGoals, visitorGoals, null);

        private static readonly SimPlayer Player = new(5, 3, 2, true, 20, 10, 15, 4,
            [new SimPlayerParticipation("Liga", "Grupo 1", 2)]);

        private static SimulationInput Input() => new(
            [new SimTeam("A", "Equipo A", null), new SimTeam("B", "Equipo B", null)],
            [M(1, "A", "B", 2, 0), M(2, "B", "A", 1, 1), M(3, "A", "B", null, null)],
            new Dictionary<string, IReadOnlyList<SimPlayer>> { ["A"] = [Player] },
            RffmPointsSystem.Default,
            new Dictionary<string, int>());

        [Fact]
        public void Quita_los_resultados_de_la_jornada_y_de_las_siguientes()
        {
            var asOf = SimulationAsOf.AsOfRound(Input(), 2, ignoreCurrentInvolvement: false);

            Assert.Equal([true, false, false], asOf.Calendar.Select(m => m.HasResult));
        }

        [Fact]
        public void Conserva_los_resultados_de_las_jornadas_anteriores()
        {
            var asOf = SimulationAsOf.AsOfRound(Input(), 2, ignoreCurrentInvolvement: false);

            Assert.Equal((2, 0), (asOf.Calendar[0].LocalGoals, asOf.Calendar[0].VisitorGoals));
        }

        [Fact]
        public void Sin_ignorar_la_implicacion_actual_las_plantillas_no_cambian()
        {
            var asOf = SimulationAsOf.AsOfRound(Input(), 2, ignoreCurrentInvolvement: false);

            Assert.Equal(Player, asOf.SquadsByTeam["A"][0]);
        }

        [Fact]
        public void Ignorar_la_implicacion_actual_pone_a_cero_la_temporada_actual_y_conserva_la_anterior()
        {
            var asOf = SimulationAsOf.AsOfRound(Input(), 2, ignoreCurrentInvolvement: true);

            var player = asOf.SquadsByTeam["A"][0];
            Assert.Equal((0, 0, 0), (player.CurrentCalled, player.CurrentStarter, player.CurrentSubstitute));
            Assert.Equal((true, 20, 10, 15, 4), (player.HasPreviousSeason, player.PreviousCalled, player.PreviousStarter,
                player.PreviousPlayed, player.PreviousGoals));
        }
    }
}
