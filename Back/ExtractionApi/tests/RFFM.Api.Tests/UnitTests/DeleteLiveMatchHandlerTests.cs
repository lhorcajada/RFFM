#nullable enable
using System;
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
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.LiveMatch;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteLiveMatchHandlerTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public DeleteLiveMatchHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record Seeded(string EventId, string TeamId, string CoachId, string OutsiderId, string AdminId);

        private static async Task<Seeded> SeedEventAsync(AppDbContext db)
        {
            var club = Club.Create($"Delete Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Delete Team",
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
            var adminId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));
            db.UserClubs.Add(new UserClub(adminId, club.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();

            return new Seeded(sportEvent.Id, team.Id, coachId, outsiderId, adminId);
        }

        private static async Task SeedLiveStateAndParticipationAsync(AppDbContext db, Seeded seeded)
        {
            var state = LiveMatchState.Create(seeded.EventId, seeded.TeamId, 60, KickOffAt, "seed");
            state.Apply(new LiveMatchActionInput(LiveMatchActionTypes.KickOff, null, null, null, null, null, null), KickOffAt, "seed");
            db.LiveMatchStates.Add(state);

            var participation = MatchParticipation.Create(
                seeded.EventId, seeded.TeamId, Guid.NewGuid().ToString(),
                minutesPlayed: 90, isStarter: true,
                enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0,
                matchPhase: "finished",
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: null,
                cardsJson: null);
            db.MatchParticipations.Add(participation);
            await db.SaveChangesAsync();
        }

        private static DeleteLiveMatch.DeleteLiveMatchCommand Command(string eventId, string userId) =>
            new(eventId, userId);

        [Fact]
        public async Task Handle_LiveStateAndParticipation_RemovesLiveStateOfEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            await SeedLiveStateAndParticipationAsync(db, seeded);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(Command(seeded.EventId, seeded.CoachId), CancellationToken.None);

            await using var reload = _fixture.CreateDbContext();
            Assert.Equal(0, await reload.LiveMatchStates.AsNoTracking().CountAsync(s => s.EventId == seeded.EventId));
        }

        [Fact]
        public async Task Handle_LiveStateAndParticipation_RemovesParticipationRowsOfEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            await SeedLiveStateAndParticipationAsync(db, seeded);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(Command(seeded.EventId, seeded.CoachId), CancellationToken.None);

            await using var reload = _fixture.CreateDbContext();
            Assert.Equal(0, await reload.MatchParticipations.AsNoTracking().CountAsync(mp => mp.EventId == seeded.EventId));
        }

        [Fact]
        public async Task Handle_LiveStateAndParticipation_BroadcastsDeletedOnce()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            await SeedLiveStateAndParticipationAsync(db, seeded);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(Command(seeded.EventId, seeded.CoachId), CancellationToken.None);

            broadcaster.Verify(b => b.BroadcastDeletedAsync(seeded.EventId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_EventWithNeitherRecord_SucceedsWithoutError()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            var exception = await Record.ExceptionAsync(() =>
                handler.Handle(Command(seeded.EventId, seeded.CoachId), CancellationToken.None).AsTask());

            Assert.Null(exception);
        }

        [Fact]
        public async Task Handle_OtherTeamCoach_ThrowsForbiddenAndRemovesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            await SeedLiveStateAndParticipationAsync(db, seeded);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                handler.Handle(Command(seeded.EventId, seeded.OutsiderId), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            Assert.Equal(1, await reload.LiveMatchStates.AsNoTracking().CountAsync(s => s.EventId == seeded.EventId));
            Assert.Equal(1, await reload.MatchParticipations.AsNoTracking().CountAsync(mp => mp.EventId == seeded.EventId));
            broadcaster.Verify(b => b.BroadcastDeletedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_AdministratorWithoutTeam_ThrowsForbiddenAndRemovesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedEventAsync(db);
            await SeedLiveStateAndParticipationAsync(db, seeded);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new DeleteLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                handler.Handle(Command(seeded.EventId, seeded.AdminId), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            Assert.Equal(1, await reload.LiveMatchStates.AsNoTracking().CountAsync(s => s.EventId == seeded.EventId));
            Assert.Equal(1, await reload.MatchParticipations.AsNoTracking().CountAsync(mp => mp.EventId == seeded.EventId));
        }

        [Fact]
        public void Validator_EmptyEventId_IsInvalid()
        {
            var validator = new DeleteLiveMatch.Validator();

            var result = validator.Validate(Command(string.Empty, "u1"));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_EmptyUserId_IsInvalid()
        {
            var validator = new DeleteLiveMatch.Validator();

            var result = validator.Validate(Command("e1", string.Empty));

            Assert.False(result.IsValid);
        }
    }
}
