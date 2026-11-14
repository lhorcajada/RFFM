#nullable enable
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Capacities = RFFM.Api.Features.Coaches.Players.Commands.ManageTeamCapacities;
using Traits = RFFM.Api.Features.Coaches.Players.Commands.ManageTeamTraits;

namespace RFFM.Api.Tests.UnitTests
{
    public class ManageTeamTraitsValidatorTests
    {
        private static bool CreateIsValid(string label = "Juego aéreo", string phase = "withBall", string a1 = "1", string a3 = "3", string a5 = "5", string teamId = "team-1") =>
            new Traits.CreateTraitValidator().Validate(new Traits.CreateTraitCommand(teamId, new Traits.CreateTraitRequest(label, phase, a1, a3, a5))).IsValid;

        private static bool UpdateIsValid(string key = "traitPressing", string? label = "Etiqueta", string? phase = null, string? a1 = null) =>
            new Traits.UpdateTraitValidator().Validate(new Traits.UpdateTraitCommand("team-1", key, new Traits.UpdateTraitRequest(label, phase, a1, null, null))).IsValid;

        [Fact]
        public void Valid_trait_passes() => Assert.True(CreateIsValid());

        [Fact]
        public void Empty_team_fails() => Assert.False(CreateIsValid(teamId: ""));

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Empty_label_fails(string label) => Assert.False(CreateIsValid(label: label));

        [Fact]
        public void Label_longer_than_80_fails() => Assert.False(CreateIsValid(label: new string('x', 81)));

        [Fact]
        public void Unknown_phase_fails() => Assert.False(CreateIsValid(phase: "nowhere"));

        [Theory]
        [InlineData("", "3", "5")]
        [InlineData("1", "", "5")]
        [InlineData("1", "3", "")]
        public void Empty_descriptor_fails(string a1, string a3, string a5) => Assert.False(CreateIsValid(a1: a1, a3: a3, a5: a5));

        [Fact]
        public void Descriptor_longer_than_200_fails() => Assert.False(CreateIsValid(a1: new string('x', 201)));

        [Fact]
        public void Update_with_only_a_label_passes() => Assert.True(UpdateIsValid());

        [Fact]
        public void Update_with_an_empty_label_fails() => Assert.False(UpdateIsValid(label: ""));

        [Fact]
        public void Update_with_an_unknown_phase_fails() => Assert.False(UpdateIsValid(phase: "nowhere"));

        [Fact]
        public void Update_with_an_empty_descriptor_fails() => Assert.False(UpdateIsValid(a1: " "));

        [Fact]
        public void Update_with_nothing_to_change_fails() => Assert.False(UpdateIsValid(label: null));

        [Theory]
        [InlineData("")]
        [InlineData("bad key!")]
        public void Update_with_an_invalid_key_fails(string key) => Assert.False(UpdateIsValid(key: key));
    }

    public class ManageTeamCapacitiesValidatorTests
    {
        private static IReadOnlyList<string> Texts(int count = 10) => Enumerable.Range(1, count).Select(i => $"Nivel {i}").ToArray();

        private static bool CreateIsValid(string sheet = "field", string category = "technical", string label = "Juego aéreo", IReadOnlyList<string>? texts = null) =>
            new Capacities.CreateCapacityValidator().Validate(
                new Capacities.CreateCapacityCommand("team-1", new Capacities.CreateCapacityRequest(sheet, category, label, texts ?? Texts()))).IsValid;

        private static bool UpdateIsValid(string key = "technicalDribbling", string? label = "Etiqueta", IReadOnlyList<string>? texts = null, string? sheet = "field", string? category = "technical") =>
            new Capacities.UpdateCapacityValidator().Validate(
                new Capacities.UpdateCapacityCommand("team-1", key, new Capacities.UpdateCapacityRequest(label, texts, sheet, category))).IsValid;

        private static bool VisibilityIsValid(string key = "technicalDribbling", string? sheet = "field", string? category = "technical") =>
            new Capacities.SetCapacityVisibilityValidator().Validate(
                new Capacities.SetCapacityVisibilityCommand("team-1", key, new Capacities.SetCapacityVisibilityRequest(true, sheet, category))).IsValid;

        [Fact]
        public void Valid_capacity_passes() => Assert.True(CreateIsValid());

        [Theory]
        [InlineData("bench", "technical")]
        [InlineData("field", "other")]
        public void Unknown_sheet_or_category_fails(string sheet, string category) => Assert.False(CreateIsValid(sheet, category));

        [Fact]
        public void Empty_label_fails() => Assert.False(CreateIsValid(label: ""));

        [Fact]
        public void Label_longer_than_80_fails() => Assert.False(CreateIsValid(label: new string('x', 81)));

        [Theory]
        [InlineData(9)]
        [InlineData(11)]
        public void Wrong_number_of_level_texts_fails(int count) => Assert.False(CreateIsValid(texts: Texts(count)));

        [Fact]
        public void Empty_level_text_fails()
        {
            var texts = Texts().ToArray();
            texts[4] = "";
            Assert.False(CreateIsValid(texts: texts));
        }

        [Fact]
        public void Level_text_longer_than_200_fails()
        {
            var texts = Texts().ToArray();
            texts[0] = new string('x', 201);
            Assert.False(CreateIsValid(texts: texts));
        }

        [Fact]
        public void Update_of_a_default_capacity_needs_sheet_and_category() =>
            Assert.False(UpdateIsValid(sheet: null, category: null));

        [Fact]
        public void Update_of_a_custom_capacity_does_not_need_sheet_or_category() =>
            Assert.True(UpdateIsValid(key: "custom-0123456789abcdef0123456789abcdef", sheet: null, category: null));

        [Fact]
        public void Update_with_wrong_number_of_level_texts_fails() => Assert.False(UpdateIsValid(texts: Texts(8)));

        [Fact]
        public void Update_with_nothing_to_change_fails() => Assert.False(UpdateIsValid(label: null, texts: null));

        [Fact]
        public void Update_with_an_invalid_key_fails() => Assert.False(UpdateIsValid(key: "bad key!"));

        [Fact]
        public void Visibility_of_a_default_capacity_needs_sheet_and_category() => Assert.False(VisibilityIsValid(sheet: null, category: null));

        [Fact]
        public void Visibility_of_a_custom_capacity_does_not_need_sheet_or_category() =>
            Assert.True(VisibilityIsValid(key: "custom-0123456789abcdef0123456789abcdef", sheet: null, category: null));
    }
}
