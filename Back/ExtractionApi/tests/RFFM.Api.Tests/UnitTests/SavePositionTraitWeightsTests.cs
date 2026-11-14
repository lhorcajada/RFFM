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
using static RFFM.Api.Features.Coaches.Players.Commands.SavePositionTraitWeights;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    public class SavePositionTraitWeightsValidatorTests
    {
        private static bool IsValid(string position, params (string Trait, string Weight)[] weights) =>
            new Validator().Validate(new SavePositionTraitWeightsCommand(
                "team-1", position, new SavePositionTraitWeightsRequest(weights.ToDictionary(w => w.Trait, w => w.Weight)))).IsValid;

        [Fact]
        public void Valid_weights_pass() => Assert.True(IsValid("defensiveMidfielder", ("traitPressing", "key"), ("traitDuels", "indifferent")));

        [Fact]
        public void Unknown_position_fails() => Assert.False(IsValid("libero", ("traitPressing", "key")));

        [Fact]
        public void Unknown_trait_fails() => Assert.False(IsValid("defensiveMidfielder", ("traitMadeUp", "key")));

        [Fact]
        public void Unknown_weight_fails() => Assert.False(IsValid("defensiveMidfielder", ("traitPressing", "huge")));

        [Fact]
        public void Empty_weights_fail() => Assert.False(IsValid("defensiveMidfielder"));
    }

    [Collection(PostgresCollection.Name)]
    public class SavePositionTraitWeightsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SavePositionTraitWeightsTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService user) => new(db, user);

        private static SavePositionTraitWeightsCommand Command(string teamId, params (string Trait, string Weight)[] weights) =>
            new(teamId, "defensiveMidfielder", new SavePositionTraitWeightsRequest(weights.ToDictionary(w => w.Trait, w => w.Weight)));

        [Fact]
        public async Task Stores_the_override_and_returns_it_in_the_position_weights()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(Command(teamId, ("traitPressing", "indifferent")), CancellationToken.None);

            Assert.Equal("indifferent", result.Weights["traitPressing"]);
            Assert.Equal("key", result.Weights["traitCoverage"]);
        }

        [Fact]
        public async Task Saving_again_replaces_the_previous_overrides_of_the_position()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = CreateHandler(db, coach);
            await handler.Handle(Command(teamId, ("traitPressing", "indifferent"), ("traitDuels", "sum")), CancellationToken.None);

            await handler.Handle(Command(teamId, ("traitDuels", "key")), CancellationToken.None);

            var stored = await db.TeamTraitWeights.AsNoTracking().Where(w => w.TeamId == teamId).ToListAsync();
            var only = Assert.Single(stored);
            Assert.Equal("traitDuels", only.TraitKey);
            Assert.Equal("key", only.Weight);
        }

        [Fact]
        public async Task Overrides_of_other_positions_are_kept()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = CreateHandler(db, coach);
            await handler.Handle(new SavePositionTraitWeightsCommand(teamId, "forward", new SavePositionTraitWeightsRequest(new Dictionary<string, string> { ["traitDuels"] = "sum" })), CancellationToken.None);

            await handler.Handle(Command(teamId, ("traitPressing", "sum")), CancellationToken.None);

            Assert.Equal(2, await db.TeamTraitWeights.CountAsync(w => w.TeamId == teamId));
        }

        [Fact]
        public async Task Coach_of_another_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, outsider).Handle(Command(teamId, ("traitPressing", "sum")), CancellationToken.None).AsTask());
        }
    }
}
