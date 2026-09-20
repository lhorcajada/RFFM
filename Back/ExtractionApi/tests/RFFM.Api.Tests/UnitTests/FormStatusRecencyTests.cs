using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class FormStatusRecencyTests
    {
        [Theory]
        [InlineData(0)]
        [InlineData(7)]
        public void WithinGracePeriod_WeighsOne(int daysAgo)
        {
            Assert.Equal(1.0, FormStatusRecency.Weight(daysAgo), precision: 6);
        }

        [Fact]
        public void EightDaysAgo_WeighsAboutZeroPointNineFiveTwo()
        {
            Assert.Equal(0.952, FormStatusRecency.Weight(8), precision: 3);
        }

        [Fact]
        public void TwentyOneDaysAgo_WeighsHalf()
        {
            Assert.Equal(0.5, FormStatusRecency.Weight(21), precision: 6);
        }

        [Fact]
        public void FortyTwoDaysAgo_WeighsAboutZeroPointOneSevenSeven()
        {
            Assert.Equal(0.177, FormStatusRecency.Weight(42), precision: 3);
        }
    }
}
