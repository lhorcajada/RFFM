using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class MatchTypeWeightingTests
    {
        [Fact]
        public void LeagueMatch_WeighsFull()
        {
            Assert.Equal(1.00, MatchTypeWeighting.Weight(SportEventsConstants.MatchEventTypeId));
        }

        [Fact]
        public void FriendlyMatch_WeighsSeventyPercent()
        {
            Assert.Equal(0.70, MatchTypeWeighting.Weight(SportEventsConstants.FriendlyEventTypeId));
        }

        [Fact]
        public void Tournament_WeighsSeventyPercent()
        {
            Assert.Equal(0.70, MatchTypeWeighting.Weight(SportEventsConstants.TournamentEventTypeId));
        }

        [Fact]
        public void UnrecognizedEventTypeId_WeighsNeutral()
        {
            Assert.Equal(1.00, MatchTypeWeighting.Weight(9999));
        }
    }
}
