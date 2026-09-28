#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadCandidateFinderTests
    {
        private const int TargetSeasonStart = 2026;
        private const int PreviousSeason = 21;

        private static TeamRffm Target(string category, string teamName = "CLUB EJEMPLO C.F. 'A'", string clubCode = "1037") => new()
        {
            TeamCode = "900",
            TeamName = teamName,
            ClubCode = clubCode,
            ClubName = "CLUB EJEMPLO C.F.",
            Category = category,
            Players = new()
        };

        private static MatchRffm Acta(string teamCode, params string[] players) => new()
        {
            LocalTeamCode = "RIVAL",
            AwayTeamCode = teamCode,
            AwayPlayers = players.Select(p => new LineupPlayer { PlayerCode = p, PlayerName = $"JUGADOR {p}" }).ToList()
        };

        /// <summary>Registra un equipo en un grupo de la temporada anterior con sus actas, de la más reciente a la más antigua.</summary>
        private static void PlayedLastSeason(FakeRffmBackgroundClient client, string competitionCode, string competitionName,
            string teamCode, string teamName, params string[][] actasPlayers)
        {
            var groupCode = $"G-{competitionCode}";
            if (client.Competitions.All(c => c.Code != competitionCode))
                client.Competitions.Add(new RffmCompetition(competitionCode, competitionName, string.Empty));
            client.Groups[competitionCode] = new() { new RffmGroup(groupCode, "Grupo 1") };
            if (!client.GroupTeams.TryGetValue(groupCode, out var teams))
                client.GroupTeams[groupCode] = teams = new();
            teams.Add(new RffmGroupTeam(teamCode, teamName));

            var matches = new List<RffmGroupMatch>();
            for (var i = 0; i < actasPlayers.Length; i++)
            {
                var recordCode = $"{teamCode}-acta{i + 1}";
                matches.Add(new RffmGroupMatch(recordCode, "RIVAL", teamCode));
                client.Actas[recordCode] = Acta(teamCode, actasPlayers[i]);
            }
            client.TeamMatches[(groupCode, teamCode)] = matches;
        }

        private static void BirthYear(FakeRffmBackgroundClient client, string player, int year) =>
            client.Sheets[(player, PreviousSeason)] = () => new Player { PlayerId = player, BirthYear = year };

        private static Task<SquadCandidateSearchResult> FindAsync(FakeRffmBackgroundClient client, TeamRffm target) =>
            new SquadCandidateFinder(client, NullLogger<SquadCandidateFinder>.Instance)
                .FindAsync(target, TargetSeasonStart, PreviousSeason, CancellationToken.None);

        [Fact]
        public async Task Cadete_propone_cadetes_que_siguen_e_infantiles_que_suben_segun_las_actas_de_la_temporada_anterior()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem>
                {
                    new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true),
                    new("I1", "CLUB EJEMPLO 'B'", "SEGUNDA INFANTIL", true),
                    new("A1", "CLUB EJEMPLO 'C'", "PRIMERA ALEVIN", true)
                }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "c2011", "c2010" });
            PlayedLastSeason(client, "K2", "SEGUNDA INFANTIL", "I1", "CLUB EJEMPLO 'B'", new[] { "i2012", "i2013" });
            PlayedLastSeason(client, "K3", "PRIMERA ALEVIN", "A1", "CLUB EJEMPLO 'C'", new[] { "a2012" });
            BirthYear(client, "c2011", 2011);
            BirthYear(client, "c2010", 2010);
            BirthYear(client, "i2012", 2012);
            BirthYear(client, "i2013", 2013);
            BirthYear(client, "a2012", 2012);

            var result = await FindAsync(client, Target("CADETE"));

            // Cadete 2026-2027 = 2011-2012: 2010 pasa a juvenil y 2013 sigue siendo infantil; el alevín no es fuente del cadete.
            Assert.Equal(new[] { "c2011", "i2012" }, result.Candidates.Select(c => c.PlayerCode).OrderBy(c => c));
            var infantil = result.Candidates.Single(c => c.PlayerCode == "i2012");
            Assert.Equal((2012, "CLUB EJEMPLO 'B'"), (infantil.BirthYear, infantil.OriginTeamName));
        }

        [Fact]
        public async Task No_usa_la_plantilla_actual_de_los_equipos_del_club()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "c2011" });
            BirthYear(client, "c2011", 2011);

            await FindAsync(client, Target("CADETE"));

            Assert.Empty(client.RequestedRosters);
        }

        [Fact]
        public async Task Solo_lee_las_dos_ultimas_actas_de_cada_equipo()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'",
                new[] { "ultima", "repetido" }, new[] { "penultima", "repetido" }, new[] { "antigua" });
            foreach (var player in new[] { "ultima", "repetido", "penultima", "antigua" })
                BirthYear(client, player, 2011);

            var result = await FindAsync(client, Target("CADETE"));

            Assert.Equal(new[] { "penultima", "repetido", "ultima" }, result.Candidates.Select(c => c.PlayerCode).OrderBy(c => c));
            Assert.Equal(2, client.ActaCalls.Count);
        }

        [Fact]
        public async Task Deja_de_recorrer_grupos_cuando_ha_encontrado_todos_los_equipos_del_club()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "c2011" });
            PlayedLastSeason(client, "K2", "SEGUNDA CADETE", "X1", "OTRO CLUB", new[] { "x2011" });
            BirthYear(client, "c2011", 2011);

            await FindAsync(client, Target("CADETE"));

            Assert.Equal(new[] { "G-K1" }, client.RequestedGroupTeams);
        }

        [Fact]
        public async Task Equipo_femenino_solo_busca_en_equipos_femeninos()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem>
                {
                    new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true),
                    new("F1", "CLUB EJEMPLO FEM", "PREFERENTE FEMENINO CADETE", true)
                }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "c2011" });
            PlayedLastSeason(client, "K2", "PREFERENTE FEMENINO CADETE", "F1", "CLUB EJEMPLO FEM", new[] { "f2011" });
            BirthYear(client, "c2011", 2011);
            BirthYear(client, "f2011", 2011);

            var result = await FindAsync(client, Target("PREFERENTE FEMENINO CADETE", "CLUB EJEMPLO FEMENINO"));

            Assert.Equal("f2011", Assert.Single(result.Candidates).PlayerCode);
        }

        [Fact]
        public async Task Si_la_ficha_del_club_falla_identifica_sus_equipos_por_nombre_en_las_competiciones()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => throw new HttpRequestException("504")
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO C.F. \"A\"", new[] { "c2012" });
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "X1", "OTRO CLUB", new[] { "x2012" });
            BirthYear(client, "c2012", 2012);
            BirthYear(client, "x2012", 2012);

            var result = await FindAsync(client, Target("CADETE"));

            Assert.Equal("c2012", Assert.Single(result.Candidates).PlayerCode);
            Assert.Contains("competiciones", result.Note, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Acta_que_falla_se_ignora_sin_romper()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "falla" }, new[] { "ok" });
            client.FailingActas.Add("C1-acta1");
            BirthYear(client, "ok", 2011);

            var result = await FindAsync(client, Target("CADETE"));

            Assert.Equal("ok", Assert.Single(result.Candidates).PlayerCode);
        }

        [Fact]
        public async Task Categoria_no_soportada_no_hace_peticiones()
        {
            var client = new FakeRffmBackgroundClient();

            var result = await FindAsync(client, Target("BENJAMIN F-7"));

            Assert.Empty(result.Candidates);
            Assert.NotNull(result.Note);
            Assert.Equal(0, client.ClubTeamsCalls);
        }

        [Fact]
        public async Task Sin_club_no_hace_peticiones()
        {
            var client = new FakeRffmBackgroundClient();

            var result = await FindAsync(client, Target("CADETE", clubCode: ""));

            Assert.Empty(result.Candidates);
            Assert.NotNull(result.Note);
            Assert.Equal(0, client.ClubTeamsCalls);
        }

        [Fact]
        public async Task Jugador_sin_anio_de_nacimiento_o_con_error_se_descarta_sin_romper()
        {
            var client = new FakeRffmBackgroundClient
            {
                ClubTeams = () => new List<ClubTeamDirectoryItem> { new("C1", "CLUB EJEMPLO 'A'", "PRIMERA CADETE", true) }
            };
            PlayedLastSeason(client, "K1", "PRIMERA CADETE", "C1", "CLUB EJEMPLO 'A'", new[] { "ok", "sinAnio", "error" });
            BirthYear(client, "ok", 2012);
            client.Sheets[("error", PreviousSeason)] = () => throw new HttpRequestException("500");

            var result = await FindAsync(client, Target("CADETE"));

            Assert.Equal("ok", Assert.Single(result.Candidates).PlayerCode);
        }
    }
}
