#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LiveMatch;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateLiveMatchHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateLiveMatchHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string EventId, string CoachId)> SeedEventWithCoachAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateLive Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "CreateLive Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Amistoso",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddDays(-1),
                null, null, null, null,
                4, team.Id, null,
                isHomeMatch: true);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var coachId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (sportEvent.Id, coachId);
        }

        [Fact]
        public async Task Handle_EventWithoutLiveState_CreatesPreMatchStateAtVersionOne()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, coachId) = await SeedEventWithCoachAsync(db);
            var handler = new CreateLiveMatch.Handler(db);

            var result = await handler.Handle(new CreateLiveMatch.CreateLiveMatchCommand(eventId, coachId), CancellationToken.None);

            Assert.True(result.Created);
            Assert.Equal(LiveMatchPhases.PreMatch, result.State.Phase);
            Assert.Equal(1, result.State.Version);
        }

        [Fact]
        public async Task Handle_SecondCreate_ReturnsExistingStateWithSameVersion()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, coachId) = await SeedEventWithCoachAsync(db);
            var handler = new CreateLiveMatch.Handler(db);
            var first = await handler.Handle(new CreateLiveMatch.CreateLiveMatchCommand(eventId, coachId), CancellationToken.None);
            Assert.True(first.Created);

            var second = await handler.Handle(new CreateLiveMatch.CreateLiveMatchCommand(eventId, coachId), CancellationToken.None);

            Assert.False(second.Created);
            Assert.Equal(first.State.Version, second.State.Version);
        }

        [Fact]
        public async Task Handle_ConcurrentCreates_LeaveOneRowAndSameState()
        {
            string eventId;
            string coachId;
            await using (var seed = _fixture.CreateDbContext())
            {
                (eventId, coachId) = await SeedEventWithCoachAsync(seed);
            }

            async Task<CreateLiveMatch.CreateLiveMatchResult> CreateOnce()
            {
                await using var db = _fixture.CreateDbContext();
                return await new CreateLiveMatch.Handler(db)
                    .Handle(new CreateLiveMatch.CreateLiveMatchCommand(eventId, coachId), CancellationToken.None);
            }

            var results = await Task.WhenAll(CreateOnce(), CreateOnce());

            await using var verify = _fixture.CreateDbContext();
            var rowCount = await verify.LiveMatchStates.CountAsync(s => s.EventId == eventId);
            Assert.Equal(1, rowCount);
            Assert.All(results, r => Assert.Equal(eventId, r.State.EventId));
            Assert.Equal(results[0].State.Version, results[1].State.Version);
        }

        [Fact]
        public void Validator_EmptyEventId_IsInvalid()
        {
            var validator = new CreateLiveMatch.Validator();

            var result = validator.Validate(new CreateLiveMatch.CreateLiveMatchCommand(string.Empty, "u1"));

            Assert.False(result.IsValid);
        }
    }
}
