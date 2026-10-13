#nullable enable
using System.Collections.Generic;
using System.Linq;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Commands.CreateTeamRatingsBatch;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateTeamRatingsBatchValidatorTests
    {
        private static RatingAnswerRequest Answer(string key = "physicalSpeed", int level = 6, string category = "physical", string concept = "Rápido") =>
            new(key, category, level, concept);

        private static PlayerRatingRequest Item(string teamPlayerId = "tp-1", params RatingAnswerRequest[] answers) =>
            new(teamPlayerId, false, answers.Length > 0 ? answers : new[] { Answer() }, null);

        private static bool IsValid(params PlayerRatingRequest[] items) => IsValid("team-1", items);

        private static bool IsValid(string teamId, IReadOnlyList<PlayerRatingRequest> items) =>
            new Validator().Validate(new CreateTeamRatingsBatchCommand(teamId, new CreateTeamRatingsBatchRequest(items))).IsValid;

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

        [Fact]
        public void Player_without_answers_fails() =>
            Assert.False(IsValid(new PlayerRatingRequest("tp-1", false, new List<RatingAnswerRequest>(), null)));

        [Theory]
        [InlineData(0)]
        [InlineData(11)]
        public void Level_out_of_range_fails(int level) => Assert.False(IsValid(Item("tp-1", Answer(level: level))));

        [Fact]
        public void Repeated_characteristic_fails() =>
            Assert.False(IsValid(Item("tp-1", Answer("physicalSpeed", 5), Answer("physicalSpeed", 7))));

        [Fact]
        public void Empty_characteristic_key_fails() => Assert.False(IsValid(Item("tp-1", Answer(key: ""))));

        [Fact]
        public void Empty_category_key_fails() => Assert.False(IsValid(Item("tp-1", Answer(category: ""))));

        [Fact]
        public void Empty_concept_fails() => Assert.False(IsValid(Item("tp-1", Answer(concept: ""))));

        [Fact]
        public void Notes_longer_than_500_characters_fail() =>
            Assert.False(IsValid(new PlayerRatingRequest("tp-1", false, new[] { Answer() }, new string('a', 501))));
    }
}
