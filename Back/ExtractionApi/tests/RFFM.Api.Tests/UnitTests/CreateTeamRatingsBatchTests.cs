#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Commands.CreateTeamRatingsBatch;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateTeamRatingsBatchTests
    {
        private static readonly DateTimeOffset RatedAt = new(2026, 10, 13, 0, 0, 0, TimeSpan.Zero);

        private readonly PostgresContainerFixture _fixture;

        public CreateTeamRatingsBatchTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService currentUser) => new(db, currentUser);

        private static PlayerRatingRequest Item(string teamPlayerId, int speedLevel = 6, string? notes = null) =>
            new(teamPlayerId, false, new List<RatingAnswerRequest>
            {
                new("physicalSpeed", "physical", speedLevel, "Rápido"),
                new("physicalEndurance", "physical", 8, "Resistente"),
                new("technicalPassing", "technical", 5, "Pase correcto"),
            }, notes);

        private static CreateTeamRatingsBatchCommand Command(string teamId, params PlayerRatingRequest[] items) =>
            new(teamId, new CreateTeamRatingsBatchRequest(items, RatedAt));

        [Fact]
        public async Task Coach_creates_one_rating_per_player_with_the_same_date()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var first = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var second = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(first), Item(second, speedLevel: 4)), CancellationToken.None);

            Assert.Equal(2, result.Count);
            var stored = await db.TeamPlayerRatings.AsNoTracking()
                .Include(r => r.Details)
                .Where(r => r.TeamPlayerId == first || r.TeamPlayerId == second)
                .ToListAsync();
            Assert.Equal(2, stored.Count);
            Assert.All(stored, r => Assert.Equal(RatedAt.UtcDateTime, r.RatedAt));
            var firstRating = stored.Single(r => r.TeamPlayerId == first);
            Assert.Equal(7m, firstRating.Physical);
            Assert.Equal(5m, firstRating.Technical);
            Assert.Equal(3, firstRating.Details.Count);
        }

        [Fact]
        public async Task Response_contains_the_answers_of_each_created_rating()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(teamPlayerId)), CancellationToken.None);

            var rating = Assert.Single(result);
            Assert.Equal(teamPlayerId, rating.TeamPlayerId);
            Assert.Equal(6, rating.Answers.Single(a => a.CharacteristicKey == "physicalSpeed").Level);
        }

        [Fact]
        public async Task Notes_are_stored_per_player()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(teamId, Item(teamPlayerId, notes: "Mejora en el pase")), CancellationToken.None);

            var stored = await db.TeamPlayerRatings.AsNoTracking().SingleAsync(r => r.TeamPlayerId == teamPlayerId);
            Assert.Equal("Mejora en el pase", stored.Notes);
        }

        [Fact]
        public async Task Previous_rating_is_kept()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var coachUserId = await SeedCoachAsync(db, teamId);
            var handler = CreateHandler(db, CurrentUser(coachUserId, "Coach"));
            await handler.Handle(Command(teamId, Item(teamPlayerId, speedLevel: 3)), CancellationToken.None);

            await handler.Handle(Command(teamId, Item(teamPlayerId, speedLevel: 9)), CancellationToken.None);

            var levels = await db.TeamPlayerRatings.AsNoTracking()
                .Where(r => r.TeamPlayerId == teamPlayerId)
                .SelectMany(r => r.Details.Where(d => d.CharacteristicKey == "physicalSpeed").Select(d => d.Level))
                .ToListAsync();
            Assert.Equal(new[] { 3, 9 }, levels.OrderBy(l => l));
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
            Assert.False(await db.TeamPlayerRatings.AnyAsync(r => r.TeamPlayerId == ownPlayer || r.TeamPlayerId == foreignPlayer));
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

            Assert.False(await db.TeamPlayerRatings.AnyAsync(r => r.TeamPlayerId == teamPlayerId));
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
