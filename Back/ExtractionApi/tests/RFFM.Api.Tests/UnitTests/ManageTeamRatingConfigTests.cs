#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamRatingConfig;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;
using Capacities = RFFM.Api.Features.Coaches.Players.Commands.ManageTeamCapacities;
using Traits = RFFM.Api.Features.Coaches.Players.Commands.ManageTeamTraits;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ManageTeamRatingConfigTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ManageTeamRatingConfigTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static IReadOnlyList<string> Texts() => Enumerable.Range(1, 10).Select(i => $"Nivel {i}").ToArray();

        private static async Task<RatingConfigResponse> ReadAsync(AppDbContext db, ICurrentUserService user, string teamId) =>
            await new Handler(db, user).Handle(new GetTeamRatingConfigQuery(teamId), CancellationToken.None);

        private static Task<TraitConfigResponse> CreateTraitAsync(AppDbContext db, ICurrentUserService user, string teamId, string label = "Juego aéreo") =>
            new Traits.CreateTraitHandler(db, user).Handle(
                new Traits.CreateTraitCommand(teamId, new Traits.CreateTraitRequest(label, "withBall", "Nunca", "A veces", "Siempre")),
                CancellationToken.None).AsTask();

        private static Task<CapacityConfigResponse> CreateCapacityAsync(AppDbContext db, ICurrentUserService user, string teamId, string label = "Juego aéreo ofensivo") =>
            new Capacities.CreateCapacityHandler(db, user).Handle(
                new Capacities.CreateCapacityCommand(teamId, new Capacities.CreateCapacityRequest("field", "technical", label, Texts())),
                CancellationToken.None).AsTask();

        // ── Lectura ─────────────────────────────────────────────────────────────

        [Fact]
        public async Task A_team_without_customizations_has_an_empty_configuration()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var config = await ReadAsync(db, coach, teamId);

            Assert.Empty(config.Capacities);
            Assert.Empty(config.Traits);
        }

        [Fact]
        public async Task Customizations_of_a_team_are_not_seen_by_another_team()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var otherCoach = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");
            await CreateTraitAsync(db, coach, teamId);

            var other = await ReadAsync(db, otherCoach, otherTeamId);

            Assert.Empty(other.Traits);
        }

        [Fact]
        public async Task Unknown_team_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => ReadAsync(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"), Guid.NewGuid().ToString()));
        }

        [Fact]
        public async Task Coach_of_another_team_and_players_cannot_read_it()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => ReadAsync(db, outsider, teamId));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => ReadAsync(db, CurrentUser(Guid.NewGuid().ToString(), "Player"), teamId));
        }

        [Fact]
        public async Task Administrator_can_read_any_team()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);

            var config = await ReadAsync(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator"), teamId);

            Assert.Empty(config.Traits);
        }

        // ── Rasgos ──────────────────────────────────────────────────────────────

        [Fact]
        public async Task Creates_a_custom_trait_that_appears_in_the_configuration()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var created = await CreateTraitAsync(db, coach, teamId);

            Assert.StartsWith("custom-", created.Key);
            Assert.True(created.IsCustom);
            Assert.False(created.IsHidden);
            var config = await ReadAsync(db, coach, teamId);
            var trait = Assert.Single(config.Traits);
            Assert.Equal("Juego aéreo", trait.Label);
            Assert.Equal("withBall", trait.Phase);
            Assert.Equal("Siempre", trait.Anchor5);
        }

        [Fact]
        public async Task Editing_a_default_trait_stores_a_customization_for_that_team_only()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var otherCoach = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            var updated = await new Traits.UpdateTraitHandler(db, coach).Handle(
                new Traits.UpdateTraitCommand(teamId, "traitPressing", new Traits.UpdateTraitRequest("Presiona alto", null, null, null, null)),
                CancellationToken.None);

            Assert.Equal("traitPressing", updated.Key);
            Assert.False(updated.IsCustom);
            Assert.Equal("Presiona alto", updated.Label);
            Assert.Null(updated.Phase);
            Assert.Empty((await ReadAsync(db, otherCoach, otherTeamId)).Traits);
        }

        [Fact]
        public async Task Editing_a_default_trait_twice_keeps_a_single_customization()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = new Traits.UpdateTraitHandler(db, coach);
            await handler.Handle(new Traits.UpdateTraitCommand(teamId, "traitPressing", new Traits.UpdateTraitRequest("Uno", null, null, null, null)), CancellationToken.None);

            await handler.Handle(new Traits.UpdateTraitCommand(teamId, "traitPressing", new Traits.UpdateTraitRequest(null, "transitions", "Nunca", null, null)), CancellationToken.None);

            var trait = Assert.Single((await ReadAsync(db, coach, teamId)).Traits);
            Assert.Equal("Uno", trait.Label);
            Assert.Equal("transitions", trait.Phase);
            Assert.Equal("Nunca", trait.Anchor1);
        }

        [Fact]
        public async Task Editing_a_custom_trait_changes_its_texts()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var created = await CreateTraitAsync(db, coach, teamId);

            var updated = await new Traits.UpdateTraitHandler(db, coach).Handle(
                new Traits.UpdateTraitCommand(teamId, created.Key, new Traits.UpdateTraitRequest("Juego aéreo defensivo", "withoutBall", null, null, null)),
                CancellationToken.None);

            Assert.Equal("Juego aéreo defensivo", updated.Label);
            Assert.Equal("withoutBall", updated.Phase);
            Assert.True(updated.IsCustom);
        }

        [Theory]
        [InlineData("custom-ffffffffffffffffffffffffffffffff")]
        [InlineData("traitMadeUp")]
        public async Task Editing_an_unknown_trait_is_not_found(string key)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await Assert.ThrowsAsync<NotFoundException>(() =>
                new Traits.UpdateTraitHandler(db, coach).Handle(
                    new Traits.UpdateTraitCommand(teamId, key, new Traits.UpdateTraitRequest("Etiqueta", null, null, null, null)),
                    CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Hides_and_restores_a_default_trait()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = new Traits.SetTraitVisibilityHandler(db, coach);

            var hidden = await handler.Handle(new Traits.SetTraitVisibilityCommand(teamId, "traitDuels", new Traits.SetTraitVisibilityRequest(true)), CancellationToken.None);
            Assert.True(hidden.IsHidden);
            Assert.True(Assert.Single((await ReadAsync(db, coach, teamId)).Traits).IsHidden);

            var restored = await handler.Handle(new Traits.SetTraitVisibilityCommand(teamId, "traitDuels", new Traits.SetTraitVisibilityRequest(false)), CancellationToken.None);
            Assert.False(restored.IsHidden);
        }

        [Fact]
        public async Task Hiding_a_trait_keeps_its_saved_levels()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await PositionFitTestSupport.SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", 7, levels: new() { ["traitDuels"] = 4 });
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await new Traits.SetTraitVisibilityHandler(db, coach).Handle(
                new Traits.SetTraitVisibilityCommand(teamId, "traitDuels", new Traits.SetTraitVisibilityRequest(true)), CancellationToken.None);

            Assert.True(await db.TeamPlayerTraitRatingLevels.AnyAsync(l => l.TraitKey == "traitDuels" && l.Rating.TeamPlayerId == player));
        }

        [Fact]
        public async Task Hiding_an_unknown_trait_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await Assert.ThrowsAsync<NotFoundException>(() =>
                new Traits.SetTraitVisibilityHandler(db, coach).Handle(
                    new Traits.SetTraitVisibilityCommand(teamId, "traitMadeUp", new Traits.SetTraitVisibilityRequest(true)), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Trait_commands_are_forbidden_for_a_coach_of_another_team_and_players()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateTraitAsync(db, outsider, teamId));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateTraitAsync(db, CurrentUser(Guid.NewGuid().ToString(), "Player"), teamId));
            Assert.False(await db.TeamTraitDefinitions.AnyAsync(t => t.TeamId == teamId));
        }

        // ── Capacidades ─────────────────────────────────────────────────────────

        [Fact]
        public async Task Creates_a_custom_capacity_that_appears_in_the_configuration()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var created = await CreateCapacityAsync(db, coach, teamId);

            Assert.StartsWith("custom-", created.Key);
            var capacity = Assert.Single((await ReadAsync(db, coach, teamId)).Capacities);
            Assert.Equal("Juego aéreo ofensivo", capacity.Label);
            Assert.Equal("field", capacity.Sheet);
            Assert.Equal("technical", capacity.CategoryKey);
            Assert.Equal(10, capacity.LevelTexts!.Count);
        }

        [Fact]
        public async Task Editing_a_default_capacity_stores_a_customization_with_its_sheet_and_category()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var updated = await new Capacities.UpdateCapacityHandler(db, coach).Handle(
                new Capacities.UpdateCapacityCommand(teamId, "technicalDribbling", new Capacities.UpdateCapacityRequest("Regate en corto", null, "field", "technical")),
                CancellationToken.None);

            Assert.Equal("technicalDribbling", updated.Key);
            Assert.False(updated.IsCustom);
            Assert.Equal("Regate en corto", updated.Label);
            Assert.Null(updated.LevelTexts);
            Assert.Equal("technical", updated.CategoryKey);
        }

        [Fact]
        public async Task Editing_a_custom_capacity_never_changes_its_sheet_or_category()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var created = await CreateCapacityAsync(db, coach, teamId);

            var updated = await new Capacities.UpdateCapacityHandler(db, coach).Handle(
                new Capacities.UpdateCapacityCommand(teamId, created.Key, new Capacities.UpdateCapacityRequest("Otra etiqueta", null, "goalkeeper", "physical")),
                CancellationToken.None);

            Assert.Equal("Otra etiqueta", updated.Label);
            Assert.Equal("field", updated.Sheet);
            Assert.Equal("technical", updated.CategoryKey);
        }

        [Fact]
        public async Task Editing_an_unknown_custom_capacity_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await Assert.ThrowsAsync<NotFoundException>(() =>
                new Capacities.UpdateCapacityHandler(db, coach).Handle(
                    new Capacities.UpdateCapacityCommand(teamId, "custom-ffffffffffffffffffffffffffffffff", new Capacities.UpdateCapacityRequest("Etiqueta", null, null, null)),
                    CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Hides_and_restores_a_default_capacity()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = new Capacities.SetCapacityVisibilityHandler(db, coach);

            var hidden = await handler.Handle(
                new Capacities.SetCapacityVisibilityCommand(teamId, "physicalSpeed", new Capacities.SetCapacityVisibilityRequest(true, "field", "physical")), CancellationToken.None);
            var restored = await handler.Handle(
                new Capacities.SetCapacityVisibilityCommand(teamId, "physicalSpeed", new Capacities.SetCapacityVisibilityRequest(false, "field", "physical")), CancellationToken.None);

            Assert.True(hidden.IsHidden);
            Assert.False(restored.IsHidden);
            Assert.Single(await db.TeamCapacityDefinitions.Where(c => c.TeamId == teamId).ToListAsync());
        }

        [Fact]
        public async Task Hiding_a_capacity_keeps_the_saved_ratings()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            db.TeamPlayerRatings.Add(RFFM.Api.Domain.Entities.TeamPlayers.TeamPlayerRating.CreateConceptual(
                teamPlayerId, false, new List<(string, string, int, string)> { ("physicalSpeed", "physical", 7, "Veloz") }));
            await db.SaveChangesAsync();
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await new Capacities.SetCapacityVisibilityHandler(db, coach).Handle(
                new Capacities.SetCapacityVisibilityCommand(teamId, "physicalSpeed", new Capacities.SetCapacityVisibilityRequest(true, "field", "physical")), CancellationToken.None);

            Assert.True(await db.TeamPlayerRatingDetails.AnyAsync(d => d.CharacteristicKey == "physicalSpeed"));
        }

        [Fact]
        public async Task Capacity_commands_are_forbidden_for_a_coach_of_another_team_and_players()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateCapacityAsync(db, outsider, teamId));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateCapacityAsync(db, CurrentUser(Guid.NewGuid().ToString(), "Family"), teamId));
            Assert.False(await db.TeamCapacityDefinitions.AnyAsync(c => c.TeamId == teamId));
        }
    }
}
