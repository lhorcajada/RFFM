#nullable enable
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.PositionFit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PositionFitCalculatorTests
    {
        private static Dictionary<string, TraitWeight> Weights(params (string Key, TraitWeight Weight)[] items) =>
            items.ToDictionary(i => i.Key, i => i.Weight);

        [Fact]
        public void Catalog_has_twelve_traits_with_unique_keys()
        {
            Assert.Equal(12, TraitCatalog.All.Count);
            Assert.Equal(12, TraitCatalog.All.Select(t => t.Key).Distinct().Count());
        }

        [Fact]
        public void Catalog_groups_traits_into_four_phases()
        {
            var phases = TraitCatalog.All.GroupBy(t => t.Phase).ToDictionary(g => g.Key, g => g.Count());

            Assert.Equal(5, phases[TraitPhase.WithBall]);
            Assert.Equal(3, phases[TraitPhase.WithoutBall]);
            Assert.Equal(2, phases[TraitPhase.Transitions]);
            Assert.Equal(2, phases[TraitPhase.Transversal]);
        }

        [Fact]
        public void Role_discipline_is_its_own_trait()
        {
            Assert.Contains(TraitCatalog.All, t => t.Key == "traitRoleDiscipline" && t.Phase == TraitPhase.Transversal);
        }

        [Theory]
        [InlineData(0, false)]
        [InlineData(1, true)]
        [InlineData(5, true)]
        [InlineData(6, false)]
        public void Trait_level_is_valid_only_between_one_and_five(int level, bool expected) =>
            Assert.Equal(expected, TraitCatalog.IsValidLevel(level));

        [Fact]
        public void Every_position_except_goalkeeper_has_default_weights_for_every_trait()
        {
            foreach (var position in System.Enum.GetValues<FitPosition>().Where(p => p != FitPosition.Goalkeeper))
            {
                var weights = DefaultTraitWeights.For(position);
                foreach (var trait in TraitCatalog.All)
                    Assert.True(weights.ContainsKey(trait.Key), $"{position} lacks {trait.Key}");
            }
        }

        [Fact]
        public void Role_discipline_is_never_indifferent_for_a_field_position()
        {
            foreach (var position in System.Enum.GetValues<FitPosition>().Where(p => p != FitPosition.Goalkeeper))
                Assert.NotEqual(TraitWeight.Indifferent, DefaultTraitWeights.For(position)["traitRoleDiscipline"]);
        }

        [Fact]
        public void Fit_is_the_weighted_average_of_levels()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key), ("traitPressing", TraitWeight.Sum));
            var levels = new Dictionary<string, int> { ["traitCoverage"] = 5, ["traitPressing"] = 1 };

            var fit = PositionFitCalculator.Calculate(levels, weights);

            Assert.Equal(4.0m, fit);
        }

        [Fact]
        public void Key_counts_more_than_sum()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key), ("traitPressing", TraitWeight.Sum));
            var betterInKey = new Dictionary<string, int> { ["traitCoverage"] = 5, ["traitPressing"] = 3 };
            var betterInSum = new Dictionary<string, int> { ["traitCoverage"] = 3, ["traitPressing"] = 5 };

            Assert.True(PositionFitCalculator.Calculate(betterInKey, weights) > PositionFitCalculator.Calculate(betterInSum, weights));
        }

        [Fact]
        public void Indifferent_trait_does_not_change_the_fit()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key), ("traitBeatsOneOnOne", TraitWeight.Indifferent));
            var low = new Dictionary<string, int> { ["traitCoverage"] = 4, ["traitBeatsOneOnOne"] = 1 };
            var high = new Dictionary<string, int> { ["traitCoverage"] = 4, ["traitBeatsOneOnOne"] = 5 };

            Assert.Equal(PositionFitCalculator.Calculate(low, weights), PositionFitCalculator.Calculate(high, weights));
        }

        [Fact]
        public void Traits_without_level_are_ignored()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key), ("traitPressing", TraitWeight.Key));
            var levels = new Dictionary<string, int> { ["traitCoverage"] = 4 };

            Assert.Equal(4.0m, PositionFitCalculator.Calculate(levels, weights));
        }

        [Fact]
        public void Fit_is_null_when_no_counting_trait_has_a_level()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key), ("traitBeatsOneOnOne", TraitWeight.Indifferent));
            var levels = new Dictionary<string, int> { ["traitBeatsOneOnOne"] = 5 };

            Assert.Null(PositionFitCalculator.Calculate(levels, weights));
        }

        [Fact]
        public void Fit_is_null_without_any_level()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Key));

            Assert.Null(PositionFitCalculator.Calculate(new Dictionary<string, int>(), weights));
        }

        [Fact]
        public void Fit_is_rounded_to_one_decimal()
        {
            var weights = Weights(("traitCoverage", TraitWeight.Sum), ("traitPressing", TraitWeight.Sum), ("traitDuels", TraitWeight.Sum));
            var levels = new Dictionary<string, int> { ["traitCoverage"] = 5, ["traitPressing"] = 4, ["traitDuels"] = 4 };

            Assert.Equal(4.3m, PositionFitCalculator.Calculate(levels, weights));
        }

        [Fact]
        public void Same_player_has_different_fit_in_different_positions()
        {
            var levels = TraitCatalog.All.ToDictionary(t => t.Key, _ => 3);
            levels["traitCoverage"] = 5;
            levels["traitArrivesAndFinishes"] = 1;

            var defensive = PositionFitCalculator.Calculate(levels, DefaultTraitWeights.For(FitPosition.DefensiveMidfielder));
            var attacking = PositionFitCalculator.Calculate(levels, DefaultTraitWeights.For(FitPosition.AttackingMidfielder));

            Assert.True(defensive > attacking);
        }
    }
}
