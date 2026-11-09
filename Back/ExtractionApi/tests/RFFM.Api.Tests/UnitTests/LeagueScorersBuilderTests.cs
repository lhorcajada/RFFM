using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Features.Coaches.LeagueScorers;
using RFFM.Api.Features.Federation.Teams.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class LeagueScorersBuilderTests
    {
        private static LeagueScorersBuilder.MatchInput Match(int round, string code, string home = "Alameda", string away = "Pinar",
            bool final = true, string homeCode = "H", string awayCode = "A") =>
            new(round, code, final, "01/11/2026", "10:00", home, away, homeCode, awayCode, "0", "0");

        private static Goal G(string player, string minute, string type = "100", string? code = null) =>
            new() { PlayerCode = code ?? player, PlayerName = player, Minute = minute, GoalType = type };

        private static Dictionary<string, MatchRffm> Actas(params (string Code, List<Goal> Home, List<Goal> Away)[] items) =>
            items.ToDictionary(i => i.Code, i => new MatchRffm { LocalGoalsList = i.Home, AwayGoalsList = i.Away });

        private static LeagueScorersResponse Build(IReadOnlyList<LeagueScorersBuilder.MatchInput> matches,
            Dictionary<string, MatchRffm> actas, int? round = null, string? ownTeamCode = null) =>
            LeagueScorersBuilder.Build(matches, actas, round, ownTeamCode);

        [Fact]
        public void Ordena_los_goles_por_minuto_con_añadido_y_los_vacios_al_final()
        {
            var matches = new[] { Match(1, "R1") };
            var actas = Actas(("R1", new() { G("Ana", "90+2'"), G("Bea", ""), G("Eva", "12'") }, new() { G("Cris", "90'") }));

            var goals = Build(matches, actas).Matches.Single().Goals;

            Assert.Equal(new[] { "Eva", "Cris", "Ana", "Bea" }, goals.Select(g => g.Player));
        }

        [Fact]
        public void Clasifica_el_tipo_de_gol_y_asigna_el_equipo_de_la_lista()
        {
            var matches = new[] { Match(1, "R1", home: "Alameda", away: "Pinar") };
            var actas = Actas(("R1", new() { G("Ana", "5", "100"), G("Bea", "6", "101") }, new() { G("Cris", "7", "102") }));

            var goals = Build(matches, actas).Matches.Single().Goals;

            Assert.Equal(new[] { "normal", "penalty", "ownGoal" }, goals.Select(g => g.Type));
            Assert.Equal(new[] { "Alameda", "Alameda", "Pinar" }, goals.Select(g => g.Team));
        }

        [Fact]
        public void Los_goles_en_propia_no_cuentan_en_el_ranking()
        {
            var matches = new[] { Match(1, "R1") };
            var actas = Actas(("R1", new() { G("Ana", "5", "102"), G("Bea", "6") }, new()));

            var scorers = Build(matches, actas).Scorers;

            Assert.Equal(new[] { "Bea" }, scorers.Select(s => s.Player));
        }

        [Fact]
        public void Acumula_los_goles_hasta_la_jornada_pedida()
        {
            var matches = new[] { Match(5, "R5"), Match(8, "R8") };
            var actas = Actas(
                ("R5", new() { G("Ana", "5"), G("Ana", "9") }, new()),
                ("R8", new() { G("Ana", "20") }, new()));

            Assert.Equal(3, Build(matches, actas, round: 8).Scorers.Single().Goals);
            Assert.Equal(2, Build(matches, actas, round: 5).Scorers.Single().Goals);
        }

        [Fact]
        public void Agrupa_por_codigo_de_jugador_y_si_falta_por_nombre_y_equipo()
        {
            var matches = new[] { Match(1, "R1"), Match(2, "R2") };
            var actas = Actas(
                ("R1", new() { G("Ana Gil", "5", code: "P1"), G("Luis Sin Codigo", "6", code: "") }, new()),
                ("R2", new() { G("ANA GIL", "5", code: "P1"), G(" luis sin codigo ", "7", code: "") }, new()));

            var scorers = Build(matches, actas).Scorers;

            Assert.Equal(2, scorers.Count);
            Assert.All(scorers, s => Assert.Equal(2, s.Goals));
        }

        [Fact]
        public void Ordena_por_goles_y_luego_por_nombre_y_limita_a_20()
        {
            var matches = new[] { Match(1, "R1") };
            var goals = Enumerable.Range(1, 25).Select(i => G($"Jugador {i:00}", "5")).ToList();
            goals.Add(G("Jugador 25", "9"));
            var actas = Actas(("R1", goals, new()));

            var scorers = Build(matches, actas).Scorers;

            Assert.Equal(20, scorers.Count);
            Assert.Equal("Jugador 25", scorers[0].Player);
            Assert.Equal(2, scorers[0].Goals);
            Assert.Equal("Jugador 01", scorers[1].Player);
            Assert.Equal(new[] { 1, 2, 3 }, scorers.Take(3).Select(s => s.Rank));
        }

        [Fact]
        public void Cada_gol_lleva_el_total_de_goles_del_jugador_en_la_temporada_hasta_la_jornada()
        {
            var matches = new[] { Match(5, "R5"), Match(8, "R8") };
            var actas = Actas(
                ("R5", new() { G("Ana", "5"), G("Ana", "9") }, new()),
                ("R8", new() { G("Ana", "20"), G("Bea", "30") }, new()));

            var round8 = Build(matches, actas, round: 8).Matches.Single().Goals;
            var round5 = Build(matches, actas, round: 5).Matches.Single().Goals;

            Assert.Equal(3, round8.Single(g => g.Player == "Ana").SeasonGoals);
            Assert.Equal(1, round8.Single(g => g.Player == "Bea").SeasonGoals);
            Assert.All(round5, g => Assert.Equal(2, g.SeasonGoals));
        }

        [Fact]
        public void Dos_goles_del_mismo_jugador_en_un_partido_muestran_el_mismo_total()
        {
            var matches = new[] { Match(1, "R1") };
            var actas = Actas(("R1", new() { G("Ana", "5"), G("Ana", "9") }, new()));

            var goals = Build(matches, actas).Matches.Single().Goals;

            Assert.All(goals, g => Assert.Equal(2, g.SeasonGoals));
        }

        [Fact]
        public void El_total_se_calcula_para_todos_los_jugadores_aunque_no_entren_en_el_ranking()
        {
            var matches = new[] { Match(1, "R1") };
            var goals = Enumerable.Range(1, 25).Select(i => G($"Jugador {i:00}", "5")).ToList();
            var actas = Actas(("R1", goals, new()));

            var result = Build(matches, actas);

            Assert.Equal(20, result.Scorers.Count);
            Assert.All(result.Matches.Single().Goals, g => Assert.Equal(1, g.SeasonGoals));
        }

        [Fact]
        public void Un_gol_en_propia_no_lleva_total_y_no_suma_al_total_del_jugador()
        {
            var matches = new[] { Match(1, "R1") };
            var actas = Actas(("R1", new() { G("Ana", "5", "102"), G("Ana", "9") }, new()));

            var goals = Build(matches, actas).Matches.Single().Goals;

            Assert.Null(goals.Single(g => g.Type == "ownGoal").SeasonGoals);
            Assert.Equal(1, goals.Single(g => g.Type == "normal").SeasonGoals);
        }

        [Fact]
        public void Un_partido_cerrado_sin_acta_se_marca_pendiente_sin_goles()
        {
            var matches = new[] { Match(1, "R1"), Match(1, "R2", final: false) };

            var result = Build(matches, new Dictionary<string, MatchRffm>());

            var closed = result.Matches.Single(m => m.RecordCode == "R1");
            var upcoming = result.Matches.Single(m => m.RecordCode == "R2");
            Assert.True(closed.PendingActa);
            Assert.Empty(closed.Goals);
            Assert.False(upcoming.PendingActa);
            Assert.Empty(upcoming.Goals);
        }

        [Fact]
        public void Sin_jornada_pedida_usa_la_ultima_con_partidos_cerrados_y_lista_todas_las_jornadas()
        {
            var matches = new[] { Match(7, "R7"), Match(8, "R8"), Match(9, "R9", final: false) };
            var actas = Actas(("R7", new(), new()), ("R8", new(), new()));

            var result = Build(matches, actas);

            Assert.Equal(8, result.Round);
            Assert.Equal(new[] { 7, 8, 9 }, result.Rounds);
        }

        [Fact]
        public void Marca_el_partido_del_equipo_propio_por_su_codigo_rffm()
        {
            var matches = new[] { Match(1, "R1", homeCode: "X", awayCode: "OWN"), Match(1, "R2", homeCode: "Y", awayCode: "Z") };

            var result = Build(matches, new Dictionary<string, MatchRffm>(), ownTeamCode: "OWN");

            Assert.True(result.Matches.Single(m => m.RecordCode == "R1").IsOwnTeam);
            Assert.False(result.Matches.Single(m => m.RecordCode == "R2").IsOwnTeam);
        }

        [Fact]
        public void Sin_partidos_devuelve_una_respuesta_vacia()
        {
            var result = Build(new List<LeagueScorersBuilder.MatchInput>(), new Dictionary<string, MatchRffm>());

            Assert.Empty(result.Rounds);
            Assert.Empty(result.Matches);
            Assert.Empty(result.Scorers);
        }
    }
}
