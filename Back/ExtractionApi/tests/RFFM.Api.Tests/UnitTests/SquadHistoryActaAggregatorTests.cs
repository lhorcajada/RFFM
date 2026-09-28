using System.Collections.Generic;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SquadHistoryActaAggregatorTests
    {
        private const string Player = "P1";
        private const string Team = "555";

        private static MatchRffm HomeActa(bool starter, List<Goal>? goals = null, List<Card>? cards = null) => new()
        {
            LocalTeamCode = Team,
            AwayTeamCode = "777",
            LocalPlayers = new() { new LineupPlayer { PlayerCode = Player, Starter = starter ? "1" : "0" } },
            LocalGoalsList = goals ?? new(),
            LocalCards = cards ?? new()
        };

        private static MatchRffm AwayActaWithoutPlayer() => new()
        {
            LocalTeamCode = "777",
            AwayTeamCode = Team,
            AwayPlayers = new() { new LineupPlayer { PlayerCode = "OTHER", Starter = "1" } }
        };

        [Fact]
        public void Cuenta_convocatorias_y_titularidades_del_lado_del_equipo()
        {
            var actas = new[] { HomeActa(starter: true), HomeActa(starter: false), AwayActaWithoutPlayer() };

            var stats = SquadHistoryActaAggregator.Aggregate(Player, Team, actas);

            Assert.Equal((2, 1), (stats.CallUps, stats.Starts));
        }

        [Fact]
        public void Cuenta_goles_sin_goles_en_propia_puerta()
        {
            var goals = new List<Goal>
            {
                new() { PlayerCode = Player, GoalType = "100" },
                new() { PlayerCode = Player, GoalType = "101" },
                new() { PlayerCode = Player, GoalType = "102" },
                new() { PlayerCode = "OTHER", GoalType = "100" }
            };

            var stats = SquadHistoryActaAggregator.Aggregate(Player, Team, new[] { HomeActa(true, goals) });

            Assert.Equal(2, stats.Goals);
        }

        [Fact]
        public void Cuenta_rojas_directas_y_dobles_amarillas_como_rojas()
        {
            var cards = new List<Card>
            {
                new() { PlayerCode = Player, CardType = "100" },
                new() { PlayerCode = Player, CardType = "102" },
                new() { PlayerCode = Player, CardType = "100", SecondYellow = "1" },
                new() { PlayerCode = Player, CardType = "101" },
                new() { PlayerCode = "OTHER", CardType = "101" }
            };

            var stats = SquadHistoryActaAggregator.Aggregate(Player, Team, new[] { HomeActa(true, cards: cards) });

            Assert.Equal((1, 3), (stats.YellowCards, stats.RedCards));
        }

        [Fact]
        public void Ignora_actas_de_partidos_de_otros_equipos()
        {
            var foreign = new MatchRffm
            {
                LocalTeamCode = "1",
                AwayTeamCode = "2",
                LocalPlayers = new() { new LineupPlayer { PlayerCode = Player, Starter = "1" } }
            };

            var stats = SquadHistoryActaAggregator.Aggregate(Player, Team, new[] { foreign });

            Assert.Equal((0, 0), (stats.CallUps, stats.Starts));
        }
    }
}
