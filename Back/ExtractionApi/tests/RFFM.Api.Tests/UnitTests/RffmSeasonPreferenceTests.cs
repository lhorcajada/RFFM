#nullable enable
using RFFM.Api.Domain.Entities.Federation;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmSeasonPreferenceTests
    {
        [Fact]
        public void Constructor_WithValidUserIdAndSeasonId_CreatesPreference()
        {
            var preference = new RffmSeasonPreference("user-1", 22);

            Assert.Equal("user-1", preference.UserId);
            Assert.Equal(22, preference.SeasonId);
            Assert.False(string.IsNullOrEmpty(preference.Id));
        }

        [Fact]
        public void Constructor_WithEmptyUserId_ThrowsArgumentException()
        {
            Assert.Throws<System.ArgumentException>(() => new RffmSeasonPreference("", 22));
        }

        [Fact]
        public void UpdateSeason_ChangesSeasonId()
        {
            var preference = new RffmSeasonPreference("user-1", 22);

            preference.UpdateSeason(21);

            Assert.Equal(21, preference.SeasonId);
        }
    }
}
