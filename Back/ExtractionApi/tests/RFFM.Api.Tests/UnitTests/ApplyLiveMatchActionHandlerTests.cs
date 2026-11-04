#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
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
    public class ApplyLiveMatchActionHandlerTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public ApplyLiveMatchActionHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static LiveMatchActionInput Input(string type, int? deltaSeconds = null) =>
            new(type, null, deltaSeconds, null, null, null, null);

        private static async Task<(string EventId, string TeamId, string CoachId, string OutsiderId)> SeedEventAsync(AppDbContext db)
        {
            var club = Club.Create($"ApplyLive Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "ApplyLive Team",
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
            var outsiderId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (sportEvent.Id, team.Id, coachId, outsiderId);
        }

        // Builds a running state whose Version is targetVersion: kick-off is version 2, each adjustClock adds one.
        private static async Task SeedStateAsync(AppDbContext db, string eventId, string teamId, int targetVersion)
        {
            var state = LiveMatchState.Create(eventId, teamId, 60, KickOffAt, "seed");
            if (targetVersion >= 2)
            {
                state.Apply(Input(LiveMatchActionTypes.KickOff), KickOffAt, "seed");
            }

            for (var version = 3; version <= targetVersion; version++)
            {
                state.Apply(Input(LiveMatchActionTypes.AdjustClock, deltaSeconds: 60), KickOffAt.AddMinutes(version), "seed");
            }

            db.LiveMatchStates.Add(state);
            await db.SaveChangesAsync();
        }

        private static ApplyLiveMatchAction.ApplyLiveMatchActionCommand GoalCommand(string eventId, string userId, int baseVersion, int scoreLocal) =>
            new(eventId, userId, new ApplyLiveMatchAction.ApplyLiveMatchActionRequest(
                LiveMatchActionTypes.Goal,
                baseVersion,
                new ApplyLiveMatchAction.ActionPayload(null, null, null, scoreLocal, 0, null)));

        [Fact]
        public async Task Handle_MatchingBaseVersion_SavesActionAndIncrementsVersion()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, coachId, _) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 7);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            var result = await handler.Handle(GoalCommand(eventId, coachId, 7, 1), CancellationToken.None);

            Assert.False(result.Conflict);
            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == eventId);
            Assert.Equal(8, stored.Version);
            Assert.Equal(1, stored.ScoreLocal);
        }

        [Fact]
        public async Task Handle_MatchingBaseVersion_BroadcastsOnceAfterSave()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, coachId, _) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 7);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            await handler.Handle(GoalCommand(eventId, coachId, 7, 1), CancellationToken.None);

            broadcaster.Verify(b => b.BroadcastUpdatedAsync(eventId, It.Is<LiveMatchStateResponse>(s => s.Version == 8), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_ObsoleteBaseVersion_ReturnsConflictWithCurrentStateAndLeavesStoreUnchanged()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, coachId, _) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 8);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            var result = await handler.Handle(GoalCommand(eventId, coachId, 7, 1), CancellationToken.None);

            Assert.True(result.Conflict);
            Assert.Equal(8, result.State.Version);
            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == eventId);
            Assert.Equal(8, stored.Version);
            Assert.Equal(0, stored.ScoreLocal);
            broadcaster.Verify(b => b.BroadcastUpdatedAsync(It.IsAny<string>(), It.IsAny<LiveMatchStateResponse>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_TwoCommandsOnSameVersion_OneWinsAndOneConflicts()
        {
            string eventId;
            string coachId;
            await using (var seed = _fixture.CreateDbContext())
            {
                var (seededEventId, teamId, seededCoachId, _) = await SeedEventAsync(seed);
                await SeedStateAsync(seed, seededEventId, teamId, 7);
                eventId = seededEventId;
                coachId = seededCoachId;
            }

            var broadcaster = new Mock<ILiveMatchBroadcaster>();

            async Task<ApplyLiveMatchAction.ApplyLiveMatchActionResult> Apply(int scoreLocal)
            {
                await using var db = _fixture.CreateDbContext();
                return await new ApplyLiveMatchAction.Handler(db, broadcaster.Object)
                    .Handle(GoalCommand(eventId, coachId, 7, scoreLocal), CancellationToken.None);
            }

            var results = await Task.WhenAll(Apply(1), Apply(2));

            var winners = results.Where(r => !r.Conflict).ToList();
            var losers = results.Where(r => r.Conflict).ToList();
            Assert.Single(winners);
            Assert.Single(losers);
            Assert.Equal(8, losers[0].State.Version);
        }

        [Fact]
        public async Task Handle_AggregateRejectsAction_ThrowsDomainExceptionAndLeavesStateUnchanged()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, coachId, _) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 1);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<DomainException>(() =>
                handler.Handle(GoalCommand(eventId, coachId, 1, 1), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == eventId);
            Assert.Equal(1, stored.Version);
            broadcaster.Verify(b => b.BroadcastUpdatedAsync(It.IsAny<string>(), It.IsAny<LiveMatchStateResponse>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_NonCoach_ThrowsForbiddenAndLeavesStateUnchanged()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, _, outsiderId) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 7);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                handler.Handle(GoalCommand(eventId, outsiderId, 7, 1), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == eventId);
            Assert.Equal(7, stored.Version);
        }

        [Fact]
        public async Task Handle_NoLiveState_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, coachId, _) = await SeedEventAsync(db);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(GoalCommand(eventId, coachId, 0, 1), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_KickOff_StoresServerInstantAsClockReferenceAndReturnsServerNow()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamId, coachId, _) = await SeedEventAsync(db);
            await SeedStateAsync(db, eventId, teamId, 1);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new ApplyLiveMatchAction.Handler(db, broadcaster.Object);
            var command = new ApplyLiveMatchAction.ApplyLiveMatchActionCommand(eventId, coachId,
                new ApplyLiveMatchAction.ApplyLiveMatchActionRequest(LiveMatchActionTypes.KickOff, 1, null));
            var before = DateTime.UtcNow;

            var result = await handler.Handle(command, CancellationToken.None);

            var after = DateTime.UtcNow;
            Assert.InRange(result.State.ServerNowUtc, before, after);
            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == eventId);
            Assert.Equal(LiveMatchPhases.FirstHalf, stored.Phase);
            Assert.NotNull(stored.ClockReferenceUtc);
            Assert.InRange(stored.ClockReferenceUtc!.Value, before, after);
        }

        [Fact]
        public void Validator_UnknownActionType_IsInvalid()
        {
            var validator = new ApplyLiveMatchAction.Validator();
            var command = new ApplyLiveMatchAction.ApplyLiveMatchActionCommand("e1", "u1",
                new ApplyLiveMatchAction.ApplyLiveMatchActionRequest("explode", 1, null));

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_NegativeBaseVersion_IsInvalid()
        {
            var validator = new ApplyLiveMatchAction.Validator();
            var command = new ApplyLiveMatchAction.ApplyLiveMatchActionCommand("e1", "u1",
                new ApplyLiveMatchAction.ApplyLiveMatchActionRequest(LiveMatchActionTypes.Goal, -1, null));

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AdjustClockWithoutDeltaSeconds_IsInvalid()
        {
            var validator = new ApplyLiveMatchAction.Validator();
            var command = new ApplyLiveMatchAction.ApplyLiveMatchActionCommand("e1", "u1",
                new ApplyLiveMatchAction.ApplyLiveMatchActionRequest(LiveMatchActionTypes.AdjustClock, 1,
                    new ApplyLiveMatchAction.ActionPayload(null, null, null, null, null, null)));

            var result = validator.Validate(command);

            Assert.False(result.IsValid);
        }
    }
}
