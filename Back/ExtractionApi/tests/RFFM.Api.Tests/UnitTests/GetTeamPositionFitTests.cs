#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamPositionFit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;
using static RFFM.Api.Tests.UnitTests.PositionFitTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamPositionFitTests
    {
        private const int Mcd = 7;
        private const int Mc = 6;
        private const int Mco = 8;
        private const int Portero = 1;

        private readonly PostgresContainerFixture _fixture;

        public GetTeamPositionFitTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService user) => new(db, user);

        private static Dictionary<string, int> Levels(int coverage, int discipline = 3) =>
            new() { ["traitCoverage"] = coverage, ["traitRoleDiscipline"] = discipline };

        private static async Task<PositionFitResponse> PositionAsync(AppDbContext db, ICurrentUserService user, string teamId, string position)
        {
            var result = await CreateHandler(db, user).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None);
            return result.Single(p => p.Position == position);
        }

        [Fact]
        public async Task Returns_the_seven_unified_positions()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None);

            Assert.Equal(
                new[] { "centerBack", "fullBack", "defensiveMidfielder", "midfielder", "attackingMidfielder", "winger", "forward" },
                result.Select(p => p.Position));
        }

        [Fact]
        public async Task Proposes_the_order_by_fit_when_nothing_is_confirmed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var low = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "low", Mcd, levels: Levels(2, 2));
            var high = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "high", Mcd, levels: Levels(5, 5));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var position = await PositionAsync(db, coach, teamId, "defensiveMidfielder");

            Assert.Equal(new[] { high, low }, position.Candidates.Select(c => c.TeamPlayerId));
            Assert.Equal(new[] { 1, 2 }, position.Candidates.Select(c => c.Place));
            Assert.False(position.IsManual);
            Assert.Null(position.ConfirmedWeekStart);
        }

        [Fact]
        public async Task Trend_breaks_a_tie_in_fit()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var down = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "aaa-down", Mcd, levels: Levels(4), trend: TraitTrend.Down);
            var up = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "zzz-up", Mcd, levels: Levels(4), trend: TraitTrend.Up);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var position = await PositionAsync(db, coach, teamId, "defensiveMidfielder");

            Assert.Equal(new[] { up, down }, position.Candidates.Select(c => c.TeamPlayerId));
        }

        [Fact]
        public async Task Player_competing_in_two_positions_appears_in_both()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "both", Mc, possible: new[] { Mc, Mco }, levels: Levels(4));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var midfielder = await PositionAsync(db, coach, teamId, "midfielder");
            var attacking = await PositionAsync(db, coach, teamId, "attackingMidfielder");

            Assert.Contains(midfielder.Candidates, c => c.TeamPlayerId == player);
            Assert.Contains(attacking.Candidates, c => c.TeamPlayerId == player);
        }

        [Fact]
        public async Task Goalkeepers_are_not_candidates_of_any_position()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var keeper = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "keeper", Portero);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None);

            Assert.DoesNotContain(result.SelectMany(p => p.Candidates), c => c.TeamPlayerId == keeper);
        }

        [Fact]
        public async Task Player_without_demarcation_is_not_a_candidate()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var noPosition = await SeedPlayerAsync(db, teamId, clubId, seasonId, "nopos");
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None);

            Assert.DoesNotContain(result.SelectMany(p => p.Candidates), c => c.TeamPlayerId == noPosition);
        }

        [Fact]
        public async Task Candidate_without_trait_levels_has_no_fit_and_goes_last()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var unrated = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "aaa-unrated", Mcd);
            var rated = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "zzz-rated", Mcd, levels: Levels(1, 1));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var position = await PositionAsync(db, coach, teamId, "defensiveMidfielder");

            Assert.Equal(new[] { rated, unrated }, position.Candidates.Select(c => c.TeamPlayerId));
            Assert.Null(position.Candidates.Last().Fit);
        }

        [Fact]
        public async Task Default_weights_are_returned_for_every_trait()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var position = await PositionAsync(db, coach, teamId, "defensiveMidfielder");

            Assert.Equal(12, position.Weights.Count);
            Assert.Equal("key", position.Weights["traitCoverage"]);
        }

        [Fact]
        public async Task Team_weight_override_changes_the_fit()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "p", Mcd, levels: new() { ["traitCoverage"] = 5, ["traitPressing"] = 1 });
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var before = (await PositionAsync(db, coach, teamId, "defensiveMidfielder")).Candidates.Single().Fit;

            db.TeamTraitWeights.Add(TeamTraitWeight.Create(teamId, 4, "traitPressing", "indifferent"));
            await db.SaveChangesAsync();
            var after = (await PositionAsync(db, coach, teamId, "defensiveMidfielder")).Candidates.Single().Fit;

            Assert.NotEqual(before, after);
            Assert.Equal(5.0m, after);
        }

        [Fact]
        public async Task Returns_the_confirmed_order_with_new_candidates_appended()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var strong = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "strong", Mcd, levels: Levels(5, 5));
            var weak = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "weak", Mcd, levels: Levels(1, 1));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            db.TeamPositionFitOrders.Add(TeamPositionFitOrder.Create(teamId, 4, new DateTime(2026, 11, 9), new[] { weak }, isManual: true));
            await db.SaveChangesAsync();

            var position = await PositionAsync(db, coach, teamId, "defensiveMidfielder");

            Assert.Equal(new[] { weak, strong }, position.Candidates.Select(c => c.TeamPlayerId));
            Assert.True(position.IsManual);
            Assert.Equal(new DateTime(2026, 11, 9), position.ConfirmedWeekStart);
        }

        [Fact]
        public async Task Unknown_team_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                    .Handle(new GetTeamPositionFitQuery(Guid.NewGuid().ToString()), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Coach_of_another_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, outsider).Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Player_role_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Player"))
                    .Handle(new GetTeamPositionFitQuery(teamId), CancellationToken.None).AsTask());
        }
    }
}
