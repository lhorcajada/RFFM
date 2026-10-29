#nullable enable
using System.Linq;
using Xunit;
using static RFFM.Api.Features.Coaches.Teams.Commands.CreateTeamsBatch;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateTeamsBatchValidatorTests
    {
        private static bool IsValid(string clubId = "club-1", string seasonId = "season-1", int categoryId = 1, params string[] letters) =>
            new Validator().Validate(new CreateTeamsBatchCommand(
                new CreateTeamsBatchRequest(clubId, seasonId, categoryId, null, letters))).IsValid;

        [Fact]
        public void Valid_request_passes() => Assert.True(IsValid(letters: new[] { "A", "b" }));

        [Fact]
        public void Empty_club_id_fails() => Assert.False(IsValid(clubId: "", letters: new[] { "A" }));

        [Fact]
        public void Empty_season_id_fails() => Assert.False(IsValid(seasonId: "", letters: new[] { "A" }));

        [Fact]
        public void Zero_category_id_fails() => Assert.False(IsValid(categoryId: 0, letters: new[] { "A" }));

        [Fact]
        public void Empty_letters_fails() => Assert.False(IsValid());

        [Fact]
        public void More_than_26_letters_fails() =>
            Assert.False(IsValid(letters: Enumerable.Range(0, 27).Select(i => ((char)('A' + i % 26)).ToString()).ToArray()));

        [Theory]
        [InlineData("1")]
        [InlineData("AB")]
        [InlineData("")]
        [InlineData("Ñ")]
        public void Invalid_letter_fails(string letter) => Assert.False(IsValid(letters: new[] { "A", letter }));

        [Fact]
        public void Repeated_letters_after_normalizing_fail() => Assert.False(IsValid(letters: new[] { "a", "A" }));
    }
}
