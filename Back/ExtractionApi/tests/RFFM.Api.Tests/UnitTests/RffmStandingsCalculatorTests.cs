using RFFM.Api.Domain.Entities.Federation.Results;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmStandingsCalculatorTests
    {
        private static readonly Dictionary<string, int> NoSanctions = new();

        private static StandingsMatch M(int round, string local, string visitor, int? localGoals, int? visitorGoals) =>
            new(round, local, visitor, localGoals, visitorGoals);

        private static IReadOnlyList<StandingRow> Calculate(IReadOnlyList<StandingsMatch> calendar, int upToRound = 99,
            RffmPointsSystem? points = null, IReadOnlyDictionary<string, int>? sanctions = null, params string[] extraTeams)
        {
            var codes = calendar.SelectMany(m => new[] { m.LocalCode, m.VisitorCode }).Concat(extraTeams).Distinct();
            var teams = codes.Select(c => new StandingsTeam(c, $"Equipo {c}", $"/img/{c}.png"));
            return RffmStandingsCalculator.Calculate(teams, calendar, upToRound, points ?? RffmPointsSystem.Default,
                sanctions ?? NoSanctions);
        }

        private static string Order(IReadOnlyList<StandingRow> rows) => string.Join(",", rows.Select(r => r.TeamCode));

        private static StandingRow Row(IReadOnlyList<StandingRow> rows, string code) => rows.Single(r => r.TeamCode == code);

        [Fact]
        public void Calcula_estadisticas_generales_de_local_y_de_visitante()
        {
            var rows = Calculate([M(1, "A", "B", 2, 1), M(2, "C", "A", 0, 0)]);

            var a = Row(rows, "A");
            Assert.Equal((2, 1, 1, 0, 2, 1, 4), (a.Played, a.Won, a.Drawn, a.Lost, a.GoalsFor, a.GoalsAgainst, a.Points));
            Assert.Equal((1, 1, 0, 0, 3), (a.HomePlayed, a.HomeWon, a.HomeDrawn, a.HomeLost, a.HomePoints));
            Assert.Equal((1, 0, 1, 0, 1), (a.AwayPlayed, a.AwayWon, a.AwayDrawn, a.AwayLost, a.AwayPoints));
        }

        [Fact]
        public void Usa_los_puntos_de_la_competicion()
        {
            var rows = Calculate([M(1, "A", "B", 2, 1)], points: new RffmPointsSystem(2, 1, 0));

            Assert.Equal(2, Row(rows, "A").Points);
        }

        [Fact]
        public void Resta_los_puntos_de_sancion()
        {
            var rows = Calculate([M(1, "A", "B", 2, 1)], sanctions: new Dictionary<string, int> { ["A"] = 3 });

            Assert.Equal((0, 3), (Row(rows, "A").Points, Row(rows, "A").SanctionPoints));
        }

        [Fact]
        public void Un_partido_sin_resultado_no_cuenta()
        {
            var rows = Calculate([M(1, "A", "B", null, null)]);

            Assert.Equal(0, Row(rows, "A").Played);
        }

        [Fact]
        public void Solo_cuentan_las_jornadas_hasta_la_indicada()
        {
            var rows = Calculate([M(1, "A", "B", 2, 1), M(2, "B", "A", 3, 0)], upToRound: 1);

            Assert.Equal((1, 3), (Row(rows, "A").Played, Row(rows, "A").Points));
        }

        [Fact]
        public void La_racha_son_los_cinco_ultimos_resultados_por_orden_de_jornada()
        {
            var rows = Calculate(
            [
                M(1, "A", "B", 1, 0), M(2, "A", "B", 1, 0), M(3, "A", "B", 0, 1), M(4, "A", "B", 1, 1),
                M(6, "A", "B", 1, 0), M(5, "A", "B", 0, 2), M(7, "A", "B", 2, 0)
            ]);

            Assert.Equal("PEPGG", Row(rows, "A").Streak);
        }

        [Fact]
        public void Empate_entre_dos_con_los_dos_partidos_jugados_decide_el_enfrentamiento_directo()
        {
            var rows = Calculate([M(1, "A", "B", 1, 0), M(2, "B", "A", 0, 1), M(1, "B", "C", 9, 0), M(2, "C", "B", 0, 9)]);

            Assert.Equal("A,B,C", Order(rows));
        }

        [Fact]
        public void Empate_entre_dos_con_solo_la_ida_jugada_decide_la_diferencia_general()
        {
            var rows = Calculate([M(1, "A", "B", 1, 0), M(2, "B", "A", null, null), M(1, "C", "B", 0, 9), M(3, "B", "C", null, null)]);

            Assert.Equal("B,A,C", Order(rows));
        }

        [Fact]
        public void Triple_empate_con_los_partidos_entre_ellos_jugados_decide_la_miniliga()
        {
            // Mini-liga: todos a 6 puntos; DG entre ellos A +4, C 0, B -4 → A sale.
            // B y C vuelven a empezar como empate entre dos: B ganó los dos partidos → B antes que C.
            var rows = Calculate(
            [
                M(1, "A", "B", 3, 0), M(2, "B", "A", 0, 3),
                M(3, "B", "C", 1, 0), M(4, "C", "B", 0, 1),
                M(5, "C", "A", 1, 0), M(6, "A", "C", 0, 1)
            ]);

            Assert.Equal("A,B,C", Order(rows));
        }

        [Fact]
        public void Triple_empate_eliminatorio_los_que_quedan_vuelven_al_primer_criterio()
        {
            // A, B y C a 6 puntos; A-B aún sin jugar (mini-liga incompleta) → DG general: A +20, C +16, B +2.
            // A sale; B y C vuelven a empezar como empate entre dos: B ganó los dos partidos → B antes que C.
            var rows = Calculate(
            [
                M(1, "B", "C", 1, 0), M(2, "C", "B", 0, 1),
                M(1, "A", "D", 10, 0), M(2, "D", "A", 0, 10),
                M(3, "C", "D", 9, 0), M(4, "D", "C", 0, 9),
                M(3, "A", "B", null, null)
            ]);

            Assert.Equal("A,B,C,D", Order(rows));
        }

        [Fact]
        public void Si_el_empate_persiste_se_ordena_por_nombre()
        {
            var calendar = new[] { M(1, "X", "D", 1, 0), M(2, "D", "X", 0, 1), M(1, "Y", "D", 1, 0), M(3, "D", "Y", 0, 1) };
            var teams = new[]
            {
                new StandingsTeam("X", "Beta", ""), new StandingsTeam("Y", "Alfa", ""), new StandingsTeam("D", "Delta", "")
            };

            var rows = RffmStandingsCalculator.Calculate(teams, calendar, 99, RffmPointsSystem.Default, NoSanctions);

            Assert.Equal("Y,X,D", Order(rows));
        }

        [Fact]
        public void A_una_sola_vuelta_la_diferencia_general_va_antes_que_el_enfrentamiento_directo()
        {
            // A y B a 4 puntos; A ganó a B, pero B tiene mejor DG. Cada pareja se enfrenta una vez.
            var rows = Calculate([M(1, "A", "B", 1, 0), M(1, "C", "D", 0, 0), M(2, "B", "C", 9, 0), M(2, "D", "A", 1, 0),
                M(3, "A", "C", 0, 0), M(3, "B", "D", 0, 0)]);

            Assert.Equal("D,B,A,C", Order(rows));
        }

        [Fact]
        public void Un_equipo_sin_partidos_aparece_con_todo_a_cero()
        {
            var rows = Calculate([M(1, "A", "B", 2, 1)], extraTeams: "E");

            var e = Row(rows, "E");
            Assert.Equal((0, 0, ""), (e.Played, e.Points, e.Streak));
            Assert.Equal(Enumerable.Range(1, 3), rows.Select(r => r.Position));
        }
    }
}
