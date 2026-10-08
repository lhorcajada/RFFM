#nullable enable
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Features.Coaches.MatchReports;
using Xunit;
using static RFFM.Api.Features.Coaches.MatchReports.LiveMatchReportBuilder;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>Pure mapping of the saved live match into the match report (openspec match-report D2).</summary>
    public class LiveMatchReportBuilderTests
    {
        private static readonly Dictionary<string, PlayerInfo> Players = new()
        {
            ["tp1"] = new PlayerInfo("tp1", "Portero", 1, null),
            ["tp2"] = new PlayerInfo("tp2", "Delantero", 9, "photo.png"),
            ["tp3"] = new PlayerInfo("tp3", "Suplente", 14, null),
            ["tp4"] = new PlayerInfo("tp4", "Reserva", 20, null),
        };

        private static readonly List<ParticipationInfo> Participations = new()
        {
            new ParticipationInfo("tp1", 90, true),
            new ParticipationInfo("tp2", 60, true),
            new ParticipationInfo("tp3", 30, false),
        };

        private static LiveMatchReport Build(
            string? goalsJson = null, string? cardsJson = null, string? windowsJson = null,
            StartingLineup? lineup = null, IReadOnlyCollection<string>? convocated = null)
            => LiveMatchReportBuilder.Build(
                Players, Participations, convocated ?? new[] { "tp1", "tp2", "tp3", "tp4" },
                lineup ?? new StartingLineup("4-4-2", new Dictionary<string, int> { ["tp1"] = 0, ["tp2"] = 9 }),
                goalsJson, cardsJson, windowsJson, 92);

        [Fact]
        public void Goals_AreOrderedByMinute()
        {
            const string goals = "[" +
                "{\"minute\":52,\"scorerId\":\"tp2\",\"scorerName\":\"X\",\"isOwnTeam\":true,\"scoreAtMoment\":{\"local\":2,\"visitor\":1}}," +
                "{\"minute\":10,\"scorerId\":\"tp2\",\"scorerName\":\"X\",\"isOwnTeam\":true,\"scoreAtMoment\":{\"local\":1,\"visitor\":0}}," +
                "{\"minute\":31,\"scorerId\":null,\"scorerName\":null,\"isOwnTeam\":false,\"scoreAtMoment\":{\"local\":1,\"visitor\":1}}]";

            var report = Build(goalsJson: goals);

            Assert.Equal(new[] { 10, 31, 52 }, report.Goals.Select(g => g.Minute));
            Assert.Equal("Delantero", report.Goals[0].ScorerName);
            Assert.Null(report.Goals[1].ScorerName);
            Assert.False(report.Goals[1].IsOwnTeam);
            Assert.Equal((1, 1), (report.Goals[1].ScoreLocal, report.Goals[1].ScoreVisitor));
        }

        [Fact]
        public void Cards_AreOrderedByMinute_AndRivalCardKeepsDorsal()
        {
            const string cards = "[" +
                "{\"minute\":70,\"half\":2,\"cardType\":\"red\",\"teamPlayerId\":null,\"playerName\":null,\"isRivalPlayer\":true,\"rivalDorsal\":7}," +
                "{\"minute\":20,\"half\":1,\"cardType\":\"yellow\",\"teamPlayerId\":\"tp1\",\"playerName\":\"Old\",\"isRivalPlayer\":false,\"rivalDorsal\":null}]";

            var report = Build(cardsJson: cards);

            Assert.Equal(new[] { 20, 70 }, report.Cards.Select(c => c.Minute));
            Assert.Equal("Portero", report.Cards[0].PlayerName);
            Assert.Equal("yellow", report.Cards[0].CardType);
            Assert.True(report.Cards[1].IsRivalPlayer);
            Assert.Equal(7, report.Cards[1].RivalDorsal);
        }

        [Fact]
        public void SubstitutionWindows_AreOrderedByMinute_WithResolvedNames()
        {
            const string windows = "[" +
                "{\"windowIndex\":1,\"minute\":60,\"half\":2,\"swaps\":[{\"inPlayerId\":\"tp3\",\"outPlayerId\":\"tp2\",\"slotIndex\":9}]}," +
                "{\"windowIndex\":0,\"minute\":45,\"half\":1,\"isHalftime\":true,\"swaps\":[{\"inPlayerId\":\"tp4\",\"outPlayerId\":null,\"slotIndex\":3}]}]";

            var report = Build(windowsJson: windows);

            Assert.Equal(2, report.SubstitutionWindows.Count);
            Assert.True(report.SubstitutionWindows[0].IsHalftime);
            Assert.Equal("Reserva", report.SubstitutionWindows[0].Swaps[0].InPlayerName);
            Assert.Null(report.SubstitutionWindows[0].Swaps[0].OutPlayerName);
            Assert.Equal(1, report.SubstitutionWindows[1].WindowIndex);
            Assert.Equal("Suplente", report.SubstitutionWindows[1].Swaps[0].InPlayerName);
            Assert.Equal("Delantero", report.SubstitutionWindows[1].Swaps[0].OutPlayerName);
        }

        [Fact]
        public void NullOrCorruptJson_ProducesEmptyLists()
        {
            var report = Build(goalsJson: "not json", cardsJson: null, windowsJson: "{}");

            Assert.Empty(report.Goals);
            Assert.Empty(report.Cards);
            Assert.Empty(report.SubstitutionWindows);
        }

        [Fact]
        public void Starters_TakeSlotsFromLineup_AndBenchIncludesPlayersWhoDidNotPlay()
        {
            var report = Build();

            Assert.Equal("4-4-2", report.FormationName);
            Assert.Equal(92, report.MatchDurationMinutes);
            Assert.Equal(new[] { "tp1", "tp2" }, report.Starters.Select(s => s.TeamPlayerId));
            Assert.Equal(9, report.Starters[1].SlotIndex);
            Assert.Equal(60, report.Starters[1].MinutesPlayed);
            Assert.Equal(9, report.Starters[1].Dorsal);
            Assert.Equal(new[] { ("tp3", 30), ("tp4", 0) }, report.Bench.Select(b => (b.TeamPlayerId, b.MinutesPlayed)));
        }

        [Fact]
        public void StarterMissingFromLineup_HasNoSlot()
        {
            var report = Build(lineup: new StartingLineup(null, new Dictionary<string, int> { ["tp1"] = 0 }));

            Assert.Null(report.Starters.Single(s => s.TeamPlayerId == "tp2").SlotIndex);
        }

        [Fact]
        public void ParticipantNotConvocated_StillAppearsInBench()
        {
            var report = Build(convocated: new[] { "tp1", "tp2" });

            Assert.Equal(new[] { "tp3" }, report.Bench.Select(b => b.TeamPlayerId));
        }

        [Fact]
        public void ParseStartingLineup_ReadsFormationAndSlots()
        {
            var lineup = ParseStartingLineup("{\"formationId\":\"f\",\"formationName\":\"4-3-3\",\"slots\":{\"0\":\"tp1\",\"5\":\"tp2\",\"6\":null}}");

            Assert.NotNull(lineup);
            Assert.Equal("4-3-3", lineup!.FormationName);
            Assert.Equal(5, lineup.SlotByPlayer["tp2"]);
            Assert.Equal(2, lineup.SlotByPlayer.Count);
        }

        [Fact]
        public void ParseStartingLineup_ReturnsNullForMissingOrCorruptJson()
        {
            Assert.Null(ParseStartingLineup(null));
            Assert.Null(ParseStartingLineup("oops"));
        }
    }
}
