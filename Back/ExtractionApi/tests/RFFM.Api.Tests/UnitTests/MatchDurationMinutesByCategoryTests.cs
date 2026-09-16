using RFFM.Api.Domain.Entities.Competitions;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class MatchDurationMinutesByCategoryTests
    {
        [Theory]
        [InlineData(3, 45)] // Youth (Juveniles)
        [InlineData(4, 40)] // U14 (Cadetes)
        [InlineData(5, 35)] // U12 (Infantiles)
        [InlineData(6, 30)] // U10 (Alevines)
        public void TryGetMinutes_ForF11Category_ReturnsStandardDuration(int categoryId, int expectedMinutes)
        {
            var found = MatchDurationMinutesByCategory.TryGetMinutes(categoryId, out var minutes);

            Assert.True(found);
            Assert.Equal(expectedMinutes, minutes);
        }

        [Theory]
        [InlineData(1)] // NationalCategory
        [InlineData(2)] // Amateurs
        [InlineData(7)] // U08
        [InlineData(8)] // U06
        [InlineData(9)] // U04
        public void TryGetMinutes_ForNonF11Category_ReturnsFalse(int categoryId)
        {
            var found = MatchDurationMinutesByCategory.TryGetMinutes(categoryId, out var minutes);

            Assert.False(found);
            Assert.Equal(0, minutes);
        }
    }
}
