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
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamLatestTraitRatings;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;
using Create = RFFM.Api.Features.Coaches.Players.Commands.CreateTeamTraitRatings;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamLatestTraitRatingsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamLatestTraitRatingsTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService currentUser) => new(db, currentUser);

        private static async Task RateAsync(AppDbContext db, ICurrentUserService user, string teamId, string teamPlayerId, int coverage, DateTimeOffset ratedAt, string? trend = null)
        {
            var request = new Create.CreateTeamTraitRatingsRequest(
                new[] { new Create.PlayerTraitRatingRequest(teamPlayerId, new List<Create.TraitLevelRequest> { new("traitCoverage", coverage) }, trend) },
                ratedAt);
            await new Create.Handler(db, user).Handle(new Create.CreateTeamTraitRatingsCommand(teamId, request), CancellationToken.None);
        }

        [Fact]
        public async Task Returns_the_latest_rating_of_each_player()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            await RateAsync(db, coach, teamId, teamPlayerId, 2, new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero));
            await RateAsync(db, coach, teamId, teamPlayerId, 5, new DateTimeOffset(2026, 11, 9, 0, 0, 0, TimeSpan.Zero), "up");

            var result = await CreateHandler(db, coach).Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None);

            var rating = Assert.Single(result);
            Assert.Equal(5, rating.Levels.Single(l => l.TraitKey == "traitCoverage").Level);
            Assert.Equal("up", rating.Trend);
        }

        [Fact]
        public async Task Players_without_rating_are_not_returned()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None);

            Assert.Empty(result);
        }

        [Fact]
        public async Task Ratings_of_other_teams_are_not_returned()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var ownPlayer = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var (otherTeamId, otherClubId, otherSeasonId) = await SeedTeamAsync(db);
            var foreignPlayer = await SeedPlayerAsync(db, otherTeamId, otherClubId, otherSeasonId);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var otherCoach = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");
            await RateAsync(db, coach, teamId, ownPlayer, 3, DateTimeOffset.UtcNow);
            await RateAsync(db, otherCoach, otherTeamId, foreignPlayer, 4, DateTimeOffset.UtcNow);

            var result = await CreateHandler(db, coach).Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None);

            Assert.Equal(ownPlayer, Assert.Single(result).TeamPlayerId);
        }

        [Fact]
        public async Task Unknown_team_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                    .Handle(new GetTeamLatestTraitRatingsQuery(Guid.NewGuid().ToString()), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Coach_of_another_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, outsider).Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Player_role_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Player"))
                    .Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Administrator_can_read_any_team()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);

            var result = await CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator"))
                .Handle(new GetTeamLatestTraitRatingsQuery(teamId), CancellationToken.None);

            Assert.Empty(result);
        }
    }
}
