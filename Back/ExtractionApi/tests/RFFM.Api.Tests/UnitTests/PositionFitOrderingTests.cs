#nullable enable
using System.Linq;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PositionFitOrderingTests
    {
        private static FitCandidate Candidate(string id, decimal? fit, string trend = TraitTrend.Same, string? name = null) =>
            new(id, name ?? id, fit, trend);

        private static string[] Ids(System.Collections.Generic.IEnumerable<FitCandidate> candidates) =>
            candidates.Select(c => c.TeamPlayerId).ToArray();

        [Fact]
        public void Orders_by_fit_from_highest_to_lowest()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("a", 4.2m), Candidate("b", 3.8m), Candidate("c", 4.0m) });

            Assert.Equal(new[] { "a", "c", "b" }, Ids(proposed));
        }

        [Fact]
        public void Trend_breaks_a_tie_in_fit()
        {
            var proposed = PositionFitOrdering.Propose(new[]
            {
                Candidate("down", 4.0m, TraitTrend.Down),
                Candidate("same", 4.0m, TraitTrend.Same),
                Candidate("up", 4.0m, TraitTrend.Up),
            });

            Assert.Equal(new[] { "up", "same", "down" }, Ids(proposed));
        }

        [Fact]
        public void Name_breaks_a_tie_in_fit_and_trend()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("2", 3.0m, name: "Zubi"), Candidate("1", 3.0m, name: "Araque") });

            Assert.Equal(new[] { "1", "2" }, Ids(proposed));
        }

        [Fact]
        public void Candidates_without_fit_go_last()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("none", null), Candidate("low", 1.0m) });

            Assert.Equal(new[] { "low", "none" }, Ids(proposed));
        }

        [Fact]
        public void Confirmed_order_prevails_over_the_proposed_one()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("a", 4.2m), Candidate("b", 3.8m), Candidate("c", 4.0m) });

            var merged = PositionFitOrdering.ApplyConfirmedOrder(proposed, new[] { "c", "b", "a" });

            Assert.Equal(new[] { "c", "b", "a" }, Ids(merged));
        }

        [Fact]
        public void New_candidates_are_appended_in_proposed_order()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("a", 4.0m), Candidate("new1", 4.5m), Candidate("new2", 3.0m) });

            var merged = PositionFitOrdering.ApplyConfirmedOrder(proposed, new[] { "a" });

            Assert.Equal(new[] { "a", "new1", "new2" }, Ids(merged));
        }

        [Fact]
        public void Players_that_are_no_longer_candidates_are_dropped_from_the_confirmed_order()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("a", 4.0m), Candidate("b", 3.0m) });

            var merged = PositionFitOrdering.ApplyConfirmedOrder(proposed, new[] { "gone", "b", "a" });

            Assert.Equal(new[] { "b", "a" }, Ids(merged));
        }

        [Fact]
        public void Order_is_manual_when_it_differs_from_the_proposed_one()
        {
            var proposed = PositionFitOrdering.Propose(new[] { Candidate("a", 4.0m), Candidate("b", 3.0m) });

            Assert.True(PositionFitOrdering.IsManual(proposed, new[] { "b", "a" }));
            Assert.False(PositionFitOrdering.IsManual(proposed, new[] { "a", "b" }));
        }
    }
}
