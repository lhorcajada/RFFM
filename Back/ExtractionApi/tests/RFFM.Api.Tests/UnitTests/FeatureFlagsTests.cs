#nullable enable
using Microsoft.Extensions.Configuration;
using RFFM.Api.Infrastructure.FeatureFlags;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class FeatureFlagsTests
    {
        private static (IConfigurationRoot Config, ConfigurationFeatureFlags Flags) Create(params (string Key, string Value)[] values)
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>($"FeatureFlags:{v.Key}", v.Value)))
                .Build();
            return (config, new ConfigurationFeatureFlags(config));
        }

        [Fact]
        public void IsEnabled_WithoutConfiguration_UsesTheDefaultOfTheFlag()
        {
            var (_, flags) = Create();

            Assert.False(flags.IsEnabled(FeatureFlagCatalog.QuinielaMultipleTickets));
        }

        [Theory]
        [InlineData("true", true)]
        [InlineData("True", true)]
        [InlineData("false", false)]
        public void IsEnabled_UsesTheConfiguredValue(string configured, bool expected)
        {
            var (_, flags) = Create((FeatureFlagCatalog.QuinielaMultipleTickets, configured));

            Assert.Equal(expected, flags.IsEnabled(FeatureFlagCatalog.QuinielaMultipleTickets));
        }

        [Fact]
        public void IsEnabled_WithAnInvalidConfiguredValue_FallsBackToTheDefault()
        {
            var (_, flags) = Create((FeatureFlagCatalog.QuinielaMultipleTickets, "quizá"));

            Assert.False(flags.IsEnabled(FeatureFlagCatalog.QuinielaMultipleTickets));
        }

        [Fact]
        public void IsEnabled_ReadsTheValueAtCallTime_SoChangesApplyWithoutRestart()
        {
            var (config, flags) = Create();
            Assert.False(flags.IsEnabled(FeatureFlagCatalog.QuinielaMultipleTickets));

            config[$"FeatureFlags:{FeatureFlagCatalog.QuinielaMultipleTickets}"] = "true";

            Assert.True(flags.IsEnabled(FeatureFlagCatalog.QuinielaMultipleTickets));
        }

        [Fact]
        public void IsEnabled_WithAnUnknownFlag_Throws()
        {
            var (_, flags) = Create(("Typo", "true"));

            Assert.Throws<ArgumentException>(() => flags.IsEnabled("Typo"));
        }

        [Fact]
        public void GetAll_ListsEveryCatalogFlagWithItsEffectiveValue()
        {
            var (_, flags) = Create((FeatureFlagCatalog.QuinielaMultipleTickets, "true"));

            var all = flags.GetAll();

            Assert.Equal(FeatureFlagCatalog.All.Select(f => f.Name).Order(), all.Keys.Order());
            Assert.True(all[FeatureFlagCatalog.QuinielaMultipleTickets]);
        }

        [Fact]
        public void GetAll_IgnoresConfiguredFlagsThatAreNotInTheCatalog()
        {
            var (_, flags) = Create(("Unknown", "true"));

            Assert.DoesNotContain("Unknown", flags.GetAll().Keys);
        }

        [Fact]
        public void Catalog_HasUniqueNamesAndADescriptionForEachFlag()
        {
            Assert.Equal(FeatureFlagCatalog.All.Count, FeatureFlagCatalog.All.Select(f => f.Name).Distinct().Count());
            Assert.All(FeatureFlagCatalog.All, f => Assert.False(string.IsNullOrWhiteSpace(f.Description)));
        }
    }
}
