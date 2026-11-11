#nullable enable
using RFFM.Api.Features.Coaches.Players.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetSeasonPlayerStatsCalculatorTests
    {
        private const string Player = "tp-1";

        private static string Goals(int own, string scorer = Player) =>
            "[" + string.Join(",", Enumerable.Repeat($"{{\"scorerId\":\"{scorer}\",\"isOwnTeam\":true}}", own)) + "]";

        private static GetSeasonPlayerStats.ParticipationRow Participation(
            bool isLeague, string? goals = null, string playerId = Player, int minutes = 0, bool starter = false) =>
            new(playerId, minutes, starter, goals, isLeague);

        private static GetSeasonPlayerStats.PlayerSeasonStatsDto Single(
            params GetSeasonPlayerStats.ParticipationRow[] participations) =>
            Assert.Single(GetSeasonPlayerStats.Calculator.Calculate(participations));

        [Fact]
        public void Calculate_WithLeagueAndFriendlyGoals_SeparatesLeagueGoalsFromTotal()
        {
            var stats = Single(
                Participation(isLeague: true, goals: Goals(2)),
                Participation(isLeague: false, goals: Goals(3)));

            Assert.Equal(2, stats.LeagueGoals);
            Assert.Equal(5, stats.TotalGoals);
        }

        [Fact]
        public void Calculate_WithOnlyNonLeagueGoals_ReturnsZeroLeagueGoals()
        {
            var stats = Single(Participation(isLeague: false, goals: Goals(3)));

            Assert.Equal(0, stats.LeagueGoals);
            Assert.Equal(3, stats.TotalGoals);
        }

        [Fact]
        public void Calculate_IgnoresGoalsOfOtherPlayersAndRivals()
        {
            var mixed = $"[{{\"scorerId\":\"{Player}\",\"isOwnTeam\":true}}," +
                        "{\"scorerId\":\"tp-2\",\"isOwnTeam\":true}," +
                        $"{{\"scorerId\":\"{Player}\",\"isOwnTeam\":false}}]";

            var stats = Single(Participation(isLeague: true, goals: mixed));

            Assert.Equal(1, stats.LeagueGoals);
            Assert.Equal(1, stats.TotalGoals);
        }

        [Fact]
        public void Calculate_WithMalformedGoalsJson_ReturnsZeroGoals()
        {
            var stats = Single(Participation(isLeague: true, goals: "not-json"));

            Assert.Equal(0, stats.LeagueGoals);
            Assert.Equal(0, stats.TotalGoals);
        }

        [Fact]
        public void Calculate_KeepsMinutesStartsAndMatchesOverAllParticipations()
        {
            var stats = Single(
                Participation(isLeague: true, minutes: 60, starter: true),
                Participation(isLeague: false, minutes: 30, starter: false));

            Assert.Equal(90, stats.TotalMinutes);
            Assert.Equal(1, stats.TotalStarts);
            Assert.Equal(2, stats.TotalMatches);
        }

        [Fact]
        public void Calculate_GroupsByPlayer()
        {
            var result = GetSeasonPlayerStats.Calculator.Calculate(new[]
            {
                Participation(isLeague: true, goals: Goals(1), playerId: "tp-1"),
                Participation(isLeague: true, goals: Goals(4, "tp-2"), playerId: "tp-2"),
            });

            Assert.Equal(2, result.Count);
            Assert.Equal(4, result.Single(r => r.TeamPlayerId == "tp-2").LeagueGoals);
        }
    }
}
