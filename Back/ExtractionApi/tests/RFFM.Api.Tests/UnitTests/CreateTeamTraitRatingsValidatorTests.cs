#nullable enable
using System.Collections.Generic;
using System.Linq;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Commands.CreateTeamTraitRatings;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateTeamTraitRatingsValidatorTests
    {
        private static TraitLevelRequest Level(string key = "traitCoverage", int level = 4) => new(key, level);

        private static PlayerTraitRatingRequest Item(string teamPlayerId = "tp-1", string? trend = null, params TraitLevelRequest[] levels) =>
            new(teamPlayerId, levels.Length > 0 ? levels : new[] { Level() }, trend);

        private static bool IsValid(params PlayerTraitRatingRequest[] items) => IsValid("team-1", items);

        private static bool IsValid(string teamId, IReadOnlyList<PlayerTraitRatingRequest> items) =>
            new Validator().Validate(new CreateTeamTraitRatingsCommand(teamId, new CreateTeamTraitRatingsRequest(items))).IsValid;

        [Fact]
        public void Valid_batch_passes() => Assert.True(IsValid(Item("tp-1"), Item("tp-2")));

        [Fact]
        public void Empty_team_id_fails() => Assert.False(IsValid("", new[] { Item() }));

        [Fact]
        public void Empty_batch_fails() => Assert.False(IsValid());

        [Fact]
        public void More_than_100_players_fails() =>
            Assert.False(IsValid(Enumerable.Range(0, 101).Select(i => Item($"tp-{i}")).ToArray()));

        [Fact]
        public void Empty_player_id_fails() => Assert.False(IsValid(Item("")));

        [Fact]
        public void Repeated_player_fails() => Assert.False(IsValid(Item("tp-1"), Item("tp-1")));

        [Theory]
        [InlineData(0)]
        [InlineData(6)]
        public void Level_out_of_range_fails(int level) =>
            Assert.False(IsValid(Item("tp-1", null, Level(level: level))));

        [Fact]
        public void Unknown_trait_key_fails() =>
            Assert.False(IsValid(Item("tp-1", null, Level("traitMadeUp", 3))));

        [Fact]
        public void Repeated_trait_in_the_same_player_fails() =>
            Assert.False(IsValid(Item("tp-1", null, Level("traitCoverage", 3), Level("traitCoverage", 4))));

        [Theory]
        [InlineData("up")]
        [InlineData("same")]
        [InlineData("down")]
        [InlineData(null)]
        public void Known_trend_passes(string? trend) => Assert.True(IsValid(Item("tp-1", trend)));

        [Fact]
        public void Unknown_trend_fails() => Assert.False(IsValid(Item("tp-1", "sideways")));

        [Fact]
        public void Player_with_only_a_trend_and_no_levels_passes() =>
            Assert.True(IsValid(new PlayerTraitRatingRequest("tp-1", new List<TraitLevelRequest>(), "down")));
    }
}
