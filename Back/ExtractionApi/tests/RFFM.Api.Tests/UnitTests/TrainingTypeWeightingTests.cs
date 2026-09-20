using RFFM.Api.Features.Coaches.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TrainingTypeWeightingTests
    {
        private static readonly IReadOnlyDictionary<string, double> Weights = new Dictionary<string, double>
        {
            ["Fisico"] = 1.00,
            ["Tactico"] = 0.70,
            ["Tecnico"] = 0.40,
        };

        [Fact]
        public void SingleTypePresent_ReturnsItsWeight()
        {
            var weight = TrainingTypeWeighting.Weight(new[] { "Fisico" }, Weights);

            Assert.Equal(1.00, weight);
        }

        [Fact]
        public void MultipleTypesPresent_ReturnsAverageOfPresentOnly()
        {
            var weight = TrainingTypeWeighting.Weight(new[] { "Fisico", "Tecnico" }, Weights);

            Assert.Equal(0.70, weight, 3);
        }

        [Fact]
        public void EmptyList_ReturnsNeutralWeight()
        {
            var weight = TrainingTypeWeighting.Weight(Array.Empty<string>(), Weights);

            Assert.Equal(TrainingTypeWeighting.UntypedWeight, weight);
            Assert.Equal(1.00, weight);
        }

        [Fact]
        public void UnrecognizedType_IsIgnoredInTheAverage()
        {
            // Defensive: an unrecognized code should not blow up the calculation nor count as 0 —
            // it is simply excluded from the average, same as if it weren't present at all.
            var withUnknownOnly = TrainingTypeWeighting.Weight(new[] { "Unknown" }, Weights);
            var withUnknownAndFisico = TrainingTypeWeighting.Weight(new[] { "Unknown", "Fisico" }, Weights);

            Assert.Equal(TrainingTypeWeighting.UntypedWeight, withUnknownOnly);
            Assert.Equal(1.00, withUnknownAndFisico);
        }
    }
}
