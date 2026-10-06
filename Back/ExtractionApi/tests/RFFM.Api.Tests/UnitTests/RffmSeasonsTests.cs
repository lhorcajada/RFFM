using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmSeasonsTests
    {
        private static readonly RffmOptions Options = new()
        {
            SelectableSeasons = [new(22, "2026-2027"), new(20, "2024-2025"), new(21, "2025-2026")]
        };

        [Fact]
        public void Previous_ShouldReturnHighestLowerSeason()
        {
            Assert.Equal(21, RffmSeasons.Previous(Options, 22));
        }

        [Fact]
        public void Previous_ShouldReturnNull_WhenSeasonIsTheOldest()
        {
            Assert.Null(RffmSeasons.Previous(Options, 20));
        }

        [Fact]
        public void Label_ShouldReturnConfiguredLabel()
        {
            Assert.Equal("2025-2026", RffmSeasons.Label(Options, 21));
        }

        [Fact]
        public void Label_ShouldFallBackToId_WhenSeasonIsNotConfigured()
        {
            Assert.Equal("99", RffmSeasons.Label(Options, 99));
        }
    }
}
