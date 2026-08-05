#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class TeamRulesSetTests
    {
        private static TeamRuleInput Rule(string shortTitle, List<string>? bulletPoints = null) =>
            new(
                Id: null,
                ShortTitle: shortTitle,
                Highlight: "Highlight",
                ViolationSummary: "Violation",
                ConsequenceSummary: "Consequence",
                LongDescription: "Description",
                BulletPoints: bulletPoints,
                ConsequenceDetail: "Detail");

        [Fact]
        public void Create_WithValidData_SetsProperties()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", "Nota cierre", "Nota aplicacion");

            Assert.Equal("team-1", set.TeamId);
            Assert.Equal("Titulo", set.Title);
            Assert.Equal("Subtitulo", set.Subtitle);
            Assert.Equal("Nota inicial", set.IntroNote);
            Assert.Equal("Nota cierre", set.ClosingNote);
            Assert.Equal("Nota aplicacion", set.ApplicationNote);
            Assert.Empty(set.Rules);
        }

        [Fact]
        public void Create_WithNullOptionalNotes_SetsNullValues()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);

            Assert.Null(set.ClosingNote);
            Assert.Null(set.ApplicationNote);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTitle_Throws(string? title)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamRulesSet.Create("team-1", title!, "Subtitulo", "Nota inicial", null, null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptySubtitle_Throws(string? subtitle)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamRulesSet.Create("team-1", "Titulo", subtitle!, "Nota inicial", null, null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyIntroNote_Throws(string? introNote)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", introNote!, null, null));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Create_WithEmptyTeamId_Throws(string? teamId)
        {
            Assert.Throws<ArgumentException>(() =>
                TeamRulesSet.Create(teamId!, "Titulo", "Subtitulo", "Nota inicial", null, null));
        }

        [Fact]
        public void Create_SetsUpdatedAtToUtcNow()
        {
            var before = DateTime.UtcNow;
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);
            var after = DateTime.UtcNow;

            Assert.InRange(set.UpdatedAt, before.AddSeconds(-1), after.AddSeconds(1));
        }

        [Fact]
        public void UpdateMetadata_WithValidData_UpdatesFieldsAndTouchesUpdatedAt()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);
            var originalUpdatedAt = set.UpdatedAt;
            System.Threading.Thread.Sleep(5);

            set.UpdateMetadata("Nuevo Titulo", "Nuevo Subtitulo", "Nueva nota", "Nueva nota cierre", "Nueva nota aplicacion");

            Assert.Equal("Nuevo Titulo", set.Title);
            Assert.Equal("Nuevo Subtitulo", set.Subtitle);
            Assert.Equal("Nueva nota", set.IntroNote);
            Assert.Equal("Nueva nota cierre", set.ClosingNote);
            Assert.Equal("Nueva nota aplicacion", set.ApplicationNote);
            Assert.True(set.UpdatedAt > originalUpdatedAt);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void UpdateMetadata_WithEmptyTitle_Throws(string? title)
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);

            Assert.Throws<ArgumentException>(() =>
                set.UpdateMetadata(title!, "Subtitulo", "Nota inicial", null, null));
        }

        [Fact]
        public void ReplaceRules_WithOrderedInput_RebuildsContiguousOrderStartingAt1()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);

            set.ReplaceRules(new[] { Rule("Primera"), Rule("Segunda"), Rule("Tercera") });

            Assert.Equal(3, set.Rules.Count);
            Assert.Equal(new[] { 1, 2, 3 }, set.Rules.Select(r => r.Order));
            Assert.Equal(new[] { "Primera", "Segunda", "Tercera" }, set.Rules.Select(r => r.ShortTitle));
        }

        [Fact]
        public void ReplaceRules_ClearsPreviousRules()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);
            set.ReplaceRules(new[] { Rule("Primera"), Rule("Segunda") });
            var firstBatchIds = set.Rules.Select(r => r.Id).ToList();

            set.ReplaceRules(new[] { Rule("Nueva unica") });

            Assert.Single(set.Rules);
            Assert.DoesNotContain(set.Rules[0].Id, firstBatchIds);
        }

        [Fact]
        public void ReplaceRules_WithEmptyList_Throws()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);

            Assert.Throws<ArgumentException>(() => set.ReplaceRules(Array.Empty<TeamRuleInput>()));
        }

        [Fact]
        public void ReplaceRules_MapsAllFieldsIncludingBulletPointsAndNullableFields()
        {
            var set = TeamRulesSet.Create("team-1", "Titulo", "Subtitulo", "Nota inicial", null, null);
            var bullets = new List<string> { "Uno", "Dos" };

            set.ReplaceRules(new[]
            {
                new TeamRuleInput(
                    Id: null,
                    ShortTitle: "Regla",
                    Highlight: null,
                    ViolationSummary: "Violacion",
                    ConsequenceSummary: "Consecuencia",
                    LongDescription: null,
                    BulletPoints: bullets,
                    ConsequenceDetail: null)
            });

            var rule = Assert.Single(set.Rules);
            Assert.Equal("Regla", rule.ShortTitle);
            Assert.Null(rule.Highlight);
            Assert.Equal("Violacion", rule.ViolationSummary);
            Assert.Equal("Consecuencia", rule.ConsequenceSummary);
            Assert.Null(rule.LongDescription);
            Assert.Equal(bullets, rule.BulletPoints);
            Assert.Null(rule.ConsequenceDetail);
            Assert.Equal(set.Id, rule.TeamRulesSetId);
        }
    }
}
