#nullable enable
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.PositionFit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PositionFitMappingTests
    {
        [Theory]
        [InlineData(1, FitPosition.Goalkeeper)]
        [InlineData(2, FitPosition.FullBack)]
        [InlineData(3, FitPosition.FullBack)]
        [InlineData(4, FitPosition.CenterBack)]
        [InlineData(5, FitPosition.CenterBack)]
        [InlineData(6, FitPosition.Midfielder)]
        [InlineData(7, FitPosition.DefensiveMidfielder)]
        [InlineData(8, FitPosition.AttackingMidfielder)]
        [InlineData(9, FitPosition.Midfielder)]
        [InlineData(10, FitPosition.Midfielder)]
        [InlineData(11, FitPosition.Forward)]
        [InlineData(12, FitPosition.Forward)]
        [InlineData(13, FitPosition.Winger)]
        [InlineData(14, FitPosition.Winger)]
        public void Each_demarcation_maps_to_its_unified_position(int demarcationId, FitPosition expected) =>
            Assert.Equal(expected, FitPositionMap.PositionFor(demarcationId));

        [Fact]
        public void Every_existing_demarcation_maps_to_a_position()
        {
            foreach (var demarcation in DemarcationMaster.List())
                Assert.NotNull(FitPositionMap.PositionFor(demarcation.Id));
        }

        [Fact]
        public void Unknown_demarcation_has_no_position() => Assert.Null(FitPositionMap.PositionFor(999));

        [Fact]
        public void Left_and_right_sides_share_the_same_position()
        {
            Assert.Equal(FitPositionMap.PositionFor(DemarcationMaster.LeftBack.Id), FitPositionMap.PositionFor(DemarcationMaster.RightBack.Id));
            Assert.Equal(FitPositionMap.PositionFor(DemarcationMaster.LeftWinger.Id), FitPositionMap.PositionFor(DemarcationMaster.RightWinger.Id));
            Assert.Equal(FitPositionMap.PositionFor(DemarcationMaster.LeftMidfielder.Id), FitPositionMap.PositionFor(DemarcationMaster.RightMidfielder.Id));
        }

        [Fact]
        public void Player_competing_in_two_positions_is_a_candidate_of_both()
        {
            var positions = FitPositionMap.CandidatePositions(activePositionId: 6, possibleDemarcationIds: new[] { 6, 8 });

            Assert.Equal(new[] { FitPosition.Midfielder, FitPosition.AttackingMidfielder }.OrderBy(p => p), positions.OrderBy(p => p));
        }

        [Fact]
        public void Active_position_counts_even_when_not_in_the_possible_list()
        {
            var positions = FitPositionMap.CandidatePositions(activePositionId: 7, possibleDemarcationIds: new[] { 6 });

            Assert.Contains(FitPosition.DefensiveMidfielder, positions);
            Assert.Contains(FitPosition.Midfielder, positions);
        }

        [Fact]
        public void Candidate_positions_have_no_duplicates()
        {
            var positions = FitPositionMap.CandidatePositions(activePositionId: 9, possibleDemarcationIds: new[] { 9, 10, 6 });

            Assert.Equal(new[] { FitPosition.Midfielder }, positions);
        }

        [Fact]
        public void Player_without_demarcations_is_not_a_candidate_of_any_position()
        {
            Assert.Empty(FitPositionMap.CandidatePositions(activePositionId: null, possibleDemarcationIds: new List<int>()));
        }

        [Fact]
        public void Goalkeeper_is_excluded_from_candidate_positions()
        {
            Assert.Empty(FitPositionMap.CandidatePositions(activePositionId: 1, possibleDemarcationIds: new[] { 1 }));
        }
    }
}
