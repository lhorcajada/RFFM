#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamRatingConfigDomainTests
    {
        private static string[] Texts(int count = 10) => Enumerable.Range(1, count).Select(i => $"Nivel {i}").ToArray();

        // ── Rasgos propios y personalizados ─────────────────────────────────────

        [Fact]
        public void Custom_trait_gets_a_generated_key_that_fits_the_stored_length()
        {
            var trait = TeamTraitDefinition.CreateCustom("team-1", "Juego aéreo", "withBall", "Nunca", "A veces", "Siempre");

            Assert.StartsWith("custom-", trait.Key);
            Assert.True(trait.Key.Length <= 50);
            Assert.True(trait.IsCustom);
            Assert.False(trait.IsHidden);
        }

        [Fact]
        public void Custom_traits_get_different_keys()
        {
            var a = TeamTraitDefinition.CreateCustom("team-1", "A", "withBall", "1", "3", "5");
            var b = TeamTraitDefinition.CreateCustom("team-1", "B", "withBall", "1", "3", "5");

            Assert.NotEqual(a.Key, b.Key);
        }

        [Theory]
        [InlineData("", "withBall", "1", "3", "5")]
        [InlineData("Etiqueta", "nowhere", "1", "3", "5")]
        [InlineData("Etiqueta", "withBall", "", "3", "5")]
        [InlineData("Etiqueta", "withBall", "1", " ", "5")]
        [InlineData("Etiqueta", "withBall", "1", "3", "")]
        public void Custom_trait_requires_label_phase_and_descriptors(string label, string phase, string a1, string a3, string a5)
        {
            Assert.Throws<ArgumentException>(() => TeamTraitDefinition.CreateCustom("team-1", label, phase, a1, a3, a5));
        }

        [Fact]
        public void Custom_trait_label_is_limited_to_80_characters()
        {
            Assert.Throws<ArgumentException>(() => TeamTraitDefinition.CreateCustom("team-1", new string('x', 81), "withBall", "1", "3", "5"));
        }

        [Fact]
        public void Descriptor_is_limited_to_200_characters()
        {
            Assert.Throws<ArgumentException>(() => TeamTraitDefinition.CreateCustom("team-1", "Etiqueta", "withBall", new string('x', 201), "3", "5"));
        }

        [Fact]
        public void Customizing_a_default_trait_keeps_its_key_and_only_stores_what_changed()
        {
            var trait = TeamTraitDefinition.ForDefault("team-1", "traitPressing");

            trait.Update("Presiona alto", null, null, null, null);

            Assert.Equal("traitPressing", trait.Key);
            Assert.False(trait.IsCustom);
            Assert.Equal("Presiona alto", trait.Label);
            Assert.Null(trait.Phase);
        }

        [Fact]
        public void A_default_trait_cannot_be_created_for_an_unknown_key()
        {
            Assert.Throws<ArgumentException>(() => TeamTraitDefinition.ForDefault("team-1", "traitMadeUp"));
        }

        [Fact]
        public void Trait_can_be_hidden_and_restored()
        {
            var trait = TeamTraitDefinition.ForDefault("team-1", "traitDuels");

            trait.SetHidden(true);
            Assert.True(trait.IsHidden);
            trait.SetHidden(false);
            Assert.False(trait.IsHidden);
        }

        // ── Capacidades propias y personalizadas ────────────────────────────────

        [Fact]
        public void Custom_capacity_gets_a_generated_key_and_keeps_sheet_and_category()
        {
            var capacity = TeamCapacityDefinition.CreateCustom("team-1", "field", "technical", "Juego aéreo ofensivo", Texts());

            Assert.StartsWith("custom-", capacity.Key);
            Assert.Equal("field", capacity.Sheet);
            Assert.Equal("technical", capacity.CategoryKey);
            Assert.Equal(10, capacity.LevelTexts!.Count);
            Assert.True(capacity.IsCustom);
        }

        [Theory]
        [InlineData("field", "other")]
        [InlineData("bench", "technical")]
        public void Custom_capacity_requires_a_known_category_and_sheet(string sheet, string category)
        {
            Assert.Throws<ArgumentException>(() => TeamCapacityDefinition.CreateCustom("team-1", sheet, category, "Etiqueta", Texts()));
        }

        [Theory]
        [InlineData(9)]
        [InlineData(11)]
        public void Capacity_requires_exactly_ten_level_texts(int count)
        {
            Assert.Throws<ArgumentException>(() => TeamCapacityDefinition.CreateCustom("team-1", "field", "technical", "Etiqueta", Texts(count)));
        }

        [Fact]
        public void Capacity_level_texts_cannot_be_empty_or_too_long()
        {
            var empty = Texts();
            empty[3] = " ";
            var tooLong = Texts();
            tooLong[0] = new string('x', 201);

            Assert.Throws<ArgumentException>(() => TeamCapacityDefinition.CreateCustom("team-1", "field", "technical", "Etiqueta", empty));
            Assert.Throws<ArgumentException>(() => TeamCapacityDefinition.CreateCustom("team-1", "field", "technical", "Etiqueta", tooLong));
        }

        [Fact]
        public void Customizing_a_default_capacity_keeps_key_sheet_and_category()
        {
            var capacity = TeamCapacityDefinition.ForDefault("team-1", "technicalDribbling", "field", "technical");

            capacity.Update("Regate en corto", null);

            Assert.Equal("technicalDribbling", capacity.Key);
            Assert.False(capacity.IsCustom);
            Assert.Equal("field", capacity.Sheet);
            Assert.Equal("technical", capacity.CategoryKey);
            Assert.Equal("Regate en corto", capacity.Label);
            Assert.Null(capacity.LevelTexts);
        }

        [Fact]
        public void Editing_a_capacity_does_not_change_its_category_or_sheet()
        {
            var capacity = TeamCapacityDefinition.CreateCustom("team-1", "field", "technical", "Etiqueta", Texts());

            capacity.Update("Otra etiqueta", Texts());

            Assert.Equal("technical", capacity.CategoryKey);
            Assert.Equal("field", capacity.Sheet);
            Assert.Equal("Otra etiqueta", capacity.Label);
        }

        [Fact]
        public void Capacity_can_be_hidden_and_restored()
        {
            var capacity = TeamCapacityDefinition.ForDefault("team-1", "physicalSpeed", "field", "physical");

            capacity.SetHidden(true);
            Assert.True(capacity.IsHidden);
            capacity.SetHidden(false);
            Assert.False(capacity.IsHidden);
        }

        // ── Catálogo efectivo de rasgos ─────────────────────────────────────────

        [Fact]
        public void Without_customizations_the_effective_keys_are_the_twelve_defaults()
        {
            var keys = EffectiveTraitCatalog.Resolve(Array.Empty<TeamTraitDefinition>());

            Assert.Equal(12, keys.Visible.Count);
            Assert.Equal(keys.Visible, keys.All);
            Assert.Contains("traitCoverage", keys.Visible);
        }

        [Fact]
        public void A_custom_trait_is_part_of_the_effective_keys()
        {
            var custom = TeamTraitDefinition.CreateCustom("team-1", "Juego aéreo", "withBall", "1", "3", "5");

            var keys = EffectiveTraitCatalog.Resolve(new[] { custom });

            Assert.Equal(13, keys.Visible.Count);
            Assert.Contains(custom.Key, keys.Visible);
        }

        [Fact]
        public void A_hidden_default_is_known_but_not_visible()
        {
            var hidden = TeamTraitDefinition.ForDefault("team-1", "traitDuels");
            hidden.SetHidden(true);

            var keys = EffectiveTraitCatalog.Resolve(new[] { hidden });

            Assert.DoesNotContain("traitDuels", keys.Visible);
            Assert.Contains("traitDuels", keys.All);
            Assert.Equal(11, keys.Visible.Count);
        }

        [Fact]
        public void A_hidden_custom_trait_is_known_but_not_visible()
        {
            var custom = TeamTraitDefinition.CreateCustom("team-1", "Juego aéreo", "withBall", "1", "3", "5");
            custom.SetHidden(true);

            var keys = EffectiveTraitCatalog.Resolve(new[] { custom });

            Assert.DoesNotContain(custom.Key, keys.Visible);
            Assert.Contains(custom.Key, keys.All);
        }

        [Fact]
        public void A_label_customization_does_not_change_the_effective_keys()
        {
            var renamed = TeamTraitDefinition.ForDefault("team-1", "traitPressing");
            renamed.Update("Presiona alto", null, null, null, null);

            var keys = EffectiveTraitCatalog.Resolve(new[] { renamed });

            Assert.Equal(12, keys.Visible.Count);
        }

        [Fact]
        public void Phase_keys_parse_the_four_phases_only()
        {
            Assert.Equal(TraitPhase.WithBall, TraitPhaseKeys.TryParse("withBall"));
            Assert.Equal(TraitPhase.Transversal, TraitPhaseKeys.TryParse("transversal"));
            Assert.Null(TraitPhaseKeys.TryParse("nowhere"));
        }

        // ── Niveles guardados con claves propias ────────────────────────────────

        [Fact]
        public void A_saved_level_accepts_a_custom_trait_key()
        {
            var level = TeamPlayerTraitRatingLevel.Create("rating-1", "custom-0123456789abcdef", 4);

            Assert.Equal("custom-0123456789abcdef", level.TraitKey);
        }

        [Theory]
        [InlineData("", 3)]
        [InlineData("traitCoverage", 0)]
        [InlineData("traitCoverage", 6)]
        public void A_saved_level_still_requires_a_key_and_a_level_from_one_to_five(string key, int level)
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerTraitRatingLevel.Create("rating-1", key, level));
        }

        [Fact]
        public void A_saved_level_key_cannot_exceed_the_stored_length()
        {
            Assert.Throws<ArgumentException>(() => TeamPlayerTraitRatingLevel.Create("rating-1", new string('x', 51), 3));
        }
    }
}
