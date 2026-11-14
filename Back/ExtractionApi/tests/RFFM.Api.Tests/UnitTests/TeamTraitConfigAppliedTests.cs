#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamPositionFit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;
using static RFFM.Api.Tests.UnitTests.PositionFitTestSupport;
using Latest = RFFM.Api.Features.Coaches.Players.Queries.GetTeamLatestTraitRatings;
using Ratings = RFFM.Api.Features.Coaches.Players.Commands.CreateTeamTraitRatings;
using Traits = RFFM.Api.Features.Coaches.Players.Commands.ManageTeamTraits;
using Weights = RFFM.Api.Features.Coaches.Players.Commands.SavePositionTraitWeights;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>The traits of the team (custom and hidden) drive the validation, the weights and the fit.</summary>
    [Collection(PostgresCollection.Name)]
    public class TeamTraitConfigAppliedTests
    {
        private const int Mcd = 7;

        private readonly PostgresContainerFixture _fixture;

        public TeamTraitConfigAppliedTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static async Task<string> CreateCustomTraitAsync(AppDbContext db, ICurrentUserService user, string teamId) =>
            (await new Traits.CreateTraitHandler(db, user).Handle(
                new Traits.CreateTraitCommand(teamId, new Traits.CreateTraitRequest("Juego aéreo", "withBall", "Nunca", "A veces", "Siempre")),
                CancellationToken.None)).Key;

        private static Task HideAsync(AppDbContext db, ICurrentUserService user, string teamId, string key) =>
            new Traits.SetTraitVisibilityHandler(db, user).Handle(
                new Traits.SetTraitVisibilityCommand(teamId, key, new Traits.SetTraitVisibilityRequest(true)), CancellationToken.None).AsTask();

        private static Task<IReadOnlyList<Ratings.TraitRatingResponse>> RateAsync(
            AppDbContext db, ICurrentUserService user, string teamId, string teamPlayerId, params (string Key, int Level)[] levels) =>
            new Ratings.Handler(db, user).Handle(
                new Ratings.CreateTeamTraitRatingsCommand(teamId, new Ratings.CreateTeamTraitRatingsRequest(new[]
                {
                    new Ratings.PlayerTraitRatingRequest(teamPlayerId, levels.Select(l => new Ratings.TraitLevelRequest(l.Key, l.Level)).ToList(), null),
                })),
                CancellationToken.None).AsTask();

        private static async Task<PositionFitResponse> PositionAsync(AppDbContext db, ICurrentUserService user, string teamId) =>
            (await new Handler(db, user).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None))
                .Single(p => p.Position == "defensiveMidfielder");

        // ── Valoración ──────────────────────────────────────────────────────────

        [Fact]
        public async Task A_custom_trait_is_accepted_in_a_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var key = await CreateCustomTraitAsync(db, coach, teamId);

            var result = await RateAsync(db, coach, teamId, player, (key, 4));

            Assert.Equal(4, Assert.Single(result).Levels.Single(l => l.TraitKey == key).Level);
        }

        [Fact]
        public async Task An_unknown_trait_is_rejected_in_a_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var exception = await Assert.ThrowsAsync<DomainException>(() => RateAsync(db, coach, teamId, player, ("traitMadeUp", 3)));

            Assert.Equal(ErrorCodes.TraitNotInTeamCatalog, exception.Code);
        }

        [Fact]
        public async Task A_custom_trait_of_another_team_is_rejected_in_a_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var otherCoach = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");
            var foreignKey = await CreateCustomTraitAsync(db, otherCoach, otherTeamId);

            var exception = await Assert.ThrowsAsync<DomainException>(() => RateAsync(db, coach, teamId, player, (foreignKey, 3)));

            Assert.Equal(ErrorCodes.TraitNotInTeamCatalog, exception.Code);
        }

        [Fact]
        public async Task A_hidden_trait_is_rejected_in_a_new_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await HideAsync(db, coach, teamId, "traitDuels");

            var exception = await Assert.ThrowsAsync<DomainException>(() => RateAsync(db, coach, teamId, player, ("traitDuels", 3)));

            Assert.Equal(ErrorCodes.TraitNotInTeamCatalog, exception.Code);
        }

        [Fact]
        public async Task Nothing_is_saved_when_one_trait_of_the_batch_is_not_allowed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            await Assert.ThrowsAsync<DomainException>(() => RateAsync(db, coach, teamId, player, ("traitCoverage", 4), ("traitMadeUp", 3)));

            Assert.Empty(await new Latest.Handler(db, coach).Handle(new Latest.GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None));
        }

        [Fact]
        public async Task The_saved_levels_of_a_hidden_trait_are_still_returned()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await RateAsync(db, coach, teamId, player, ("traitDuels", 4));

            await HideAsync(db, coach, teamId, "traitDuels");

            var latest = await new Latest.Handler(db, coach).Handle(new Latest.GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None);
            Assert.Equal(4, Assert.Single(latest).Levels.Single(l => l.TraitKey == "traitDuels").Level);
        }

        // ── Pesos y encaje ──────────────────────────────────────────────────────

        [Fact]
        public async Task A_custom_trait_weighs_suma_in_every_position_until_changed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var key = await CreateCustomTraitAsync(db, coach, teamId);

            var result = await new Handler(db, coach).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None);

            Assert.All(result, position => Assert.Equal("sum", position.Weights[key]));
        }

        [Fact]
        public async Task A_hidden_trait_is_not_offered_in_the_weights()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await HideAsync(db, coach, teamId, "traitDuels");

            var position = await PositionAsync(db, coach, teamId);

            Assert.DoesNotContain("traitDuels", position.Weights.Keys);
            Assert.Equal(11, position.Weights.Count);
        }

        [Fact]
        public async Task A_custom_trait_counts_in_the_fit()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var key = await CreateCustomTraitAsync(db, coach, teamId);
            await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd, levels: new() { ["traitCoverage"] = 5, [key] = 1 });

            var fit = (await PositionAsync(db, coach, teamId)).Candidates.Single().Fit;

            // cobertura (clave = 3) con 5 y rasgo propio (suma = 1) con 1: (15 + 1) / 4
            Assert.Equal(4.0m, fit);
        }

        [Fact]
        public async Task A_hidden_trait_does_not_count_in_the_fit_and_counts_again_when_restored()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd, levels: new() { ["traitCoverage"] = 5, ["traitPressing"] = 1 });
            var before = (await PositionAsync(db, coach, teamId)).Candidates.Single().Fit;

            await HideAsync(db, coach, teamId, "traitPressing");
            var hidden = (await PositionAsync(db, coach, teamId)).Candidates.Single().Fit;
            await new Traits.SetTraitVisibilityHandler(db, coach).Handle(
                new Traits.SetTraitVisibilityCommand(teamId, "traitPressing", new Traits.SetTraitVisibilityRequest(false)), CancellationToken.None);
            var restored = (await PositionAsync(db, coach, teamId)).Candidates.Single().Fit;

            Assert.Equal(3.0m, before);
            Assert.Equal(5.0m, hidden);
            Assert.Equal(before, restored);
        }

        [Fact]
        public async Task Weights_can_be_saved_for_a_custom_trait()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var key = await CreateCustomTraitAsync(db, coach, teamId);

            var result = await new Weights.Handler(db, coach).Handle(
                new Weights.SavePositionTraitWeightsCommand(teamId, "defensiveMidfielder", new Weights.SavePositionTraitWeightsRequest(new Dictionary<string, string> { [key] = "key" })),
                CancellationToken.None);

            Assert.Equal("key", result.Weights[key]);
        }

        [Theory]
        [InlineData("traitMadeUp")]
        [InlineData("traitDuels")]
        public async Task Weights_cannot_be_saved_for_an_unknown_or_hidden_trait(string key)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await HideAsync(db, coach, teamId, "traitDuels");

            var exception = await Assert.ThrowsAsync<DomainException>(() =>
                new Weights.Handler(db, coach).Handle(
                    new Weights.SavePositionTraitWeightsCommand(teamId, "defensiveMidfielder", new Weights.SavePositionTraitWeightsRequest(new Dictionary<string, string> { [key] = "sum" })),
                    CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.TraitNotInTeamCatalog, exception.Code);
        }
    }
}
