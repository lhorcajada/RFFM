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
using static RFFM.Api.Features.Coaches.Players.Commands.CreateTeamTraitRatings;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateTeamTraitRatingsTests
    {
        private static readonly DateTimeOffset RatedAt = new(2026, 11, 9, 0, 0, 0, TimeSpan.Zero);

        private readonly PostgresContainerFixture _fixture;

        public CreateTeamTraitRatingsTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService currentUser) => new(db, currentUser);

        private static PlayerTraitRatingRequest Item(string teamPlayerId, int coverage = 4, string? trend = null) =>
            new(teamPlayerId, new List<TraitLevelRequest>
            {
                new("traitCoverage", coverage),
                new("traitRoleDiscipline", 2),
            }, trend);

        private static CreateTeamTraitRatingsCommand Command(string teamId, params PlayerTraitRatingRequest[] items) =>
            new(teamId, new CreateTeamTraitRatingsRequest(items, RatedAt));

        [Fact]
        public async Task Coach_creates_one_rating_per_player_with_the_same_date()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var first = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var second = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(first), Item(second, coverage: 5)), CancellationToken.None);

            Assert.Equal(2, result.Count);
            var stored = await db.TeamPlayerTraitRatings.AsNoTracking()
                .Include(r => r.Levels)
                .Where(r => r.TeamPlayerId == first || r.TeamPlayerId == second)
                .ToListAsync();
            Assert.Equal(2, stored.Count);
            Assert.All(stored, r => Assert.Equal(RatedAt.UtcDateTime, r.RatedAt));
            Assert.Equal(2, stored.Single(r => r.TeamPlayerId == first).Levels.Count);
        }

        [Fact]
        public async Task Response_contains_the_levels_and_trend_of_each_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(teamPlayerId, coverage: 3, trend: "up")), CancellationToken.None);

            var rating = Assert.Single(result);
            Assert.Equal(teamPlayerId, rating.TeamPlayerId);
            Assert.Equal("up", rating.Trend);
            Assert.Equal(3, rating.Levels.Single(l => l.TraitKey == "traitCoverage").Level);
        }

        [Fact]
        public async Task Trend_defaults_to_same()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(teamPlayerId)), CancellationToken.None);

            var stored = await db.TeamPlayerTraitRatings.AsNoTracking().SingleAsync(r => r.TeamPlayerId == teamPlayerId);
            Assert.Equal("same", stored.Trend);
        }

        [Fact]
        public async Task Trend_is_stored_without_changing_levels()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(teamPlayerId, coverage: 4, trend: "down")), CancellationToken.None);

            var stored = await db.TeamPlayerTraitRatings.AsNoTracking()
                .Include(r => r.Levels)
                .SingleAsync(r => r.TeamPlayerId == teamPlayerId);
            Assert.Equal("down", stored.Trend);
            Assert.Equal(4, stored.Levels.Single(l => l.TraitKey == "traitCoverage").Level);
        }

        [Fact]
        public async Task Previous_rating_is_kept()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);
            var handler = CreateHandler(db, CurrentUser(coachUserId, "Coach"));
            await handler.Handle(Command(teamId, Item(teamPlayerId, coverage: 2)), CancellationToken.None);

            await handler.Handle(Command(teamId, Item(teamPlayerId, coverage: 5)), CancellationToken.None);

            var levels = await db.TeamPlayerTraitRatings.AsNoTracking()
                .Where(r => r.TeamPlayerId == teamPlayerId)
                .SelectMany(r => r.Levels.Where(l => l.TraitKey == "traitCoverage").Select(l => l.Level))
                .ToListAsync();
            Assert.Equal(new[] { 2, 5 }, levels.OrderBy(l => l));
        }

        [Fact]
        public async Task Player_from_another_team_is_rejected_and_nothing_is_saved()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var ownPlayer = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var (otherTeamId, otherClubId, otherSeasonId) = await SeedTeamAsync(db);
            var foreignPlayer = await SeedPlayerAsync(db, otherTeamId, otherClubId, otherSeasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var exception = await Assert.ThrowsAsync<DomainException>(() =>
                CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                    .Handle(Command(teamId, Item(ownPlayer), Item(foreignPlayer)), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.RatingPlayerNotInTeam, exception.Code);
            Assert.False(await db.TeamPlayerTraitRatings.AnyAsync(r => r.TeamPlayerId == ownPlayer || r.TeamPlayerId == foreignPlayer));
        }

        [Fact]
        public async Task Unknown_team_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                    .Handle(Command(Guid.NewGuid().ToString(), Item("any-player")), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Coach_of_another_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsiderUserId = await SeedCoachAsync(db, otherTeamId);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, CurrentUser(outsiderUserId, "Coach"))
                    .Handle(Command(teamId, Item(teamPlayerId)), CancellationToken.None).AsTask());

            Assert.False(await db.TeamPlayerTraitRatings.AnyAsync(r => r.TeamPlayerId == teamPlayerId));
        }

        [Fact]
        public async Task Administrator_can_rate_any_team()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);

            var result = await CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator"))
                .Handle(Command(teamId, Item(teamPlayerId)), CancellationToken.None);

            Assert.Single(result);
        }
    }
}
