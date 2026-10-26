#nullable enable
using RFFM.Api.Features.Coaches.Players.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class GetLeaguePlayerStatsCalculatorTests
    {
        private const string Player = "tp-1";

        private static GetLeaguePlayerStats.ParticipationRow Participation(
            string playerId = Player, int minutes = 0, bool starter = false, string? goals = null, string? cards = null) =>
            new(playerId, minutes, starter, goals, cards);

        private static GetLeaguePlayerStats.LeaguePlayerStatsDto Single(
            IEnumerable<GetLeaguePlayerStats.ParticipationRow> participations,
            IEnumerable<GetLeaguePlayerStats.ConvocationRow>? convocations = null) =>
            Assert.Single(GetLeaguePlayerStats.Calculator.Calculate(
                new[] { Player }, participations.ToList(), (convocations ?? Array.Empty<GetLeaguePlayerStats.ConvocationRow>()).ToList()));

        [Fact]
        public void Calculate_WithNoData_ReturnsPlayerWithZeros()
        {
            var stats = Single(Array.Empty<GetLeaguePlayerStats.ParticipationRow>());

            Assert.Equal(new GetLeaguePlayerStats.LeaguePlayerStatsDto(Player, 0, 0, 0, 0, 0, 0), stats);
        }

        [Fact]
        public void Calculate_CountsOnlyOwnTeamGoalsOfThePlayer()
        {
            var goals = $"[{{\"scorerId\":\"{Player}\",\"isOwnTeam\":true}}," +
                        $"{{\"scorerId\":\"{Player}\",\"isOwnTeam\":true}}," +
                        "{\"scorerId\":\"tp-2\",\"isOwnTeam\":true}," +
                        $"{{\"scorerId\":\"{Player}\",\"isOwnTeam\":false}}]";

            var stats = Single(new[] { Participation(goals: goals) });

            Assert.Equal(2, stats.Goals);
        }

        [Fact]
        public void Calculate_SumsMinutesAcrossMatches()
        {
            var stats = Single(new[] { Participation(minutes: 70), Participation(minutes: 25) });

            Assert.Equal(95, stats.MinutesPlayed);
        }

        [Fact]
        public void Calculate_CountsStartsOnlyWhenStarter()
        {
            var stats = Single(new[]
            {
                Participation(starter: true), Participation(starter: true), Participation(starter: false)
            });

            Assert.Equal(2, stats.Starts);
        }

        [Fact]
        public void Calculate_CountsYellowAndRedCardsOfThePlayer()
        {
            var cards = $"[{{\"teamPlayerId\":\"{Player}\",\"cardType\":\"yellow\"}}," +
                        $"{{\"teamPlayerId\":\"rival\",\"cardType\":\"yellow\"}}]";
            var red = $"[{{\"teamPlayerId\":\"{Player}\",\"cardType\":\"red\"}}]";

            var stats = Single(new[] { Participation(cards: cards), Participation(cards: red) });

            Assert.Equal(1, stats.YellowCards);
            Assert.Equal(1, stats.RedCards);
        }

        [Fact]
        public void Calculate_IgnoresParticipationsOfOtherPlayers()
        {
            var stats = Single(new[] { Participation(playerId: "tp-2", minutes: 90, starter: true) });

            Assert.Equal(0, stats.MinutesPlayed);
            Assert.Equal(0, stats.Starts);
        }

        [Fact]
        public void Calculate_CountsCallUpsExcludingDeconvoked()
        {
            var stats = Single(
                Array.Empty<GetLeaguePlayerStats.ParticipationRow>(),
                new[]
                {
                    new GetLeaguePlayerStats.ConvocationRow(Player, GetLeaguePlayerStats.Calculator.AcceptedStatusId),
                    new GetLeaguePlayerStats.ConvocationRow(Player, GetLeaguePlayerStats.Calculator.PendingStatusId),
                    new GetLeaguePlayerStats.ConvocationRow(Player, GetLeaguePlayerStats.Calculator.DeconvokeStatusId),
                    new GetLeaguePlayerStats.ConvocationRow("tp-2", GetLeaguePlayerStats.Calculator.AcceptedStatusId)
                });

            Assert.Equal(2, stats.CallUps);
        }

        [Fact]
        public void Calculate_ReturnsOneEntryPerPlayerInRosterOrder()
        {
            var result = GetLeaguePlayerStats.Calculator.Calculate(
                new[] { "tp-b", "tp-a" },
                new List<GetLeaguePlayerStats.ParticipationRow> { Participation(playerId: "tp-a", minutes: 10) },
                new List<GetLeaguePlayerStats.ConvocationRow>());

            Assert.Equal(new[] { "tp-b", "tp-a" }, result.Select(r => r.TeamPlayerId));
            Assert.Equal(10, result[1].MinutesPlayed);
        }
    }
}
