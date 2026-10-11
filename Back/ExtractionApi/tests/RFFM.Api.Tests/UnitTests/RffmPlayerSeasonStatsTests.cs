using System;
using System.Collections.Generic;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.Players.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmPlayerSeasonStatsTests
    {
        private static readonly DateTime Now = new(2026, 10, 12, 8, 0, 0, DateTimeKind.Utc);

        private static Player Sheet(int called = 20, int goals = 7, bool withTeam = true) => new()
        {
            PlayerId = "1001",
            Name = "LUCAS PEREZ",
            BirthYear = 2012,
            Position = "Delantero",
            Matches = new MatchStatistics { Called = called, Starter = 15, Substitute = 5, Played = 18, TotalGoals = goals },
            Cards = new CardStatistics { Yellow = 3, Red = 1, DoubleYellow = 2 },
            Competitions = withTeam
                ? new List<CompetitionParticipation>
                {
                    new() { CompetitionName = "Liga Infantil", GroupName = "Grupo 1", TeamCode = "E1", TeamName = "CD Ejemplo A", TeamPoints = 40, TeamPosition = 2 }
                }
                : new List<CompetitionParticipation>()
        };

        [Fact]
        public void Create_guarda_los_totales_de_la_ficha()
        {
            var stats = RffmPlayerSeasonStats.Create("1001", 22, PlayerSeasonTotalsMapper.From(Sheet()), Now);

            Assert.Equal(("1001", 22, "LUCAS PEREZ", 2012, "Delantero"),
                (stats.PlayerCode, stats.SeasonId, stats.PlayerName, stats.BirthYear!.Value, stats.Position));
            Assert.Equal((20, 15, 5, 18, 7, 3, 1, 2),
                (stats.Called, stats.Starter, stats.Substitute, stats.Played, stats.Goals, stats.Yellow, stats.Red, stats.DoubleYellow));
            Assert.Equal(Now, stats.FetchedAt);
            Assert.True(stats.HasActivity);
        }

        [Fact]
        public void Create_serializa_los_equipos_en_los_que_participo()
        {
            var stats = RffmPlayerSeasonStats.Create("1001", 22, PlayerSeasonTotalsMapper.From(Sheet()), Now);

            var team = Assert.Single(PlayerSeasonTotalsMapper.ReadParticipations(stats.ParticipationsJson));
            Assert.Equal(("Liga Infantil", "Grupo 1", "E1", "CD Ejemplo A", 40, 2),
                (team.CompetitionName, team.GroupName, team.TeamCode, team.TeamName, team.TeamPoints, team.TeamPosition));
        }

        [Fact]
        public void Create_marca_sin_actividad_una_ficha_sin_convocatorias_ni_competiciones()
        {
            var stats = RffmPlayerSeasonStats.Create("1001", 21, PlayerSeasonTotalsMapper.From(Sheet(called: 0, goals: 0, withTeam: false)), Now);

            Assert.False(stats.HasActivity);
        }

        [Fact]
        public void Create_sin_anio_de_nacimiento_lo_deja_nulo()
        {
            var sheet = Sheet();
            sheet.BirthYear = 0;

            var stats = RffmPlayerSeasonStats.Create("1001", 22, PlayerSeasonTotalsMapper.From(sheet), Now);

            Assert.Null(stats.BirthYear);
        }

        [Fact]
        public void Update_sustituye_los_totales_y_la_fecha()
        {
            var stats = RffmPlayerSeasonStats.Create("1001", 22, PlayerSeasonTotalsMapper.From(Sheet()), Now);

            stats.Update(PlayerSeasonTotalsMapper.From(Sheet(called: 21, goals: 9)), Now.AddDays(7));

            Assert.Equal((21, 9, Now.AddDays(7)), (stats.Called, stats.Goals, stats.FetchedAt));
        }

        [Fact]
        public void Create_falla_sin_codigo_de_jugador()
        {
            Assert.Throws<ArgumentException>(() =>
                RffmPlayerSeasonStats.Create(" ", 22, PlayerSeasonTotalsMapper.From(Sheet()), Now));
        }
    }
}
