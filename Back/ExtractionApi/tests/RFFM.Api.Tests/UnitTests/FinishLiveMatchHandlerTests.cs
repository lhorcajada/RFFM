#nullable enable
using System;
using System.Collections.Generic;
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
using RFFM.Api.Domain.Entities.Players;
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
    public class FinishLiveMatchHandlerTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public FinishLiveMatchHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record Seeded(string EventId, string TeamId, string CoachId, string OutsiderId, string TeamPlayerId);

        private static LiveMatchActionInput Input(string type, int? deltaSeconds = null, int? scoreLocal = null,
            LiveMatchDocuments? documents = null) =>
            new(type, null, deltaSeconds, null, scoreLocal, scoreLocal is null ? null : 0, documents);

        private static async Task<Seeded> SeedMatchAsync(AppDbContext db)
        {
            var club = Club.Create($"Finish Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Finish Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"finish-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            // League match ("Partido") so automatic sanctions apply.
            var sportEvent = SportEvent.CreateNew(
                "Finish Partido",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddDays(-1),
                null, null, null, null,
                SportEventType.FromName("Partido").Id, team.Id, null,
                isHomeMatch: true);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var coachId = Guid.NewGuid().ToString();
            var outsiderId = Guid.NewGuid().ToString();
            db.UserTeams.Add(new UserTeam(coachId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return new Seeded(sportEvent.Id, team.Id, coachId, outsiderId, teamPlayer.Id);
        }

        // Kick-off (v2), half-time (v3), second half (v4). Further actions are added by the caller.
        private static LiveMatchState SecondHalfState(string eventId, string teamId)
        {
            var state = LiveMatchState.Create(eventId, teamId, 60, KickOffAt, "seed");
            state.Apply(Input(LiveMatchActionTypes.KickOff), KickOffAt, "seed");
            state.Apply(Input(LiveMatchActionTypes.EndHalf), KickOffAt.AddMinutes(45), "seed");
            state.Apply(Input(LiveMatchActionTypes.StartSecondHalf), KickOffAt.AddMinutes(60), "seed");
            return state;
        }

        private static FinishLiveMatch.FinishLiveMatchCommand FinishCommand(string eventId, string userId, int baseVersion,
            params FinishLiveMatch.FinishPlayer[] players) =>
            new(eventId, userId, new FinishLiveMatch.FinishLiveMatchRequest(baseVersion, players.ToList()));

        private static FinishLiveMatch.FinishPlayer Finisher(string teamPlayerId, int minutes = 90) =>
            new(teamPlayerId, minutes, true, 0, null);

        [Fact]
        public async Task Handle_SecondHalfWithPlayers_WritesParticipationWithFinalScoreAndMinutes()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            var state = SecondHalfState(seeded.EventId, seeded.TeamId);
            state.Apply(Input(LiveMatchActionTypes.Goal, scoreLocal: 1), KickOffAt.AddMinutes(70), "seed");
            db.LiveMatchStates.Add(state);
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            var result = await handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 5, Finisher(seeded.TeamPlayerId, 90)), CancellationToken.None);

            Assert.False(result.Conflict);
            await using var reload = _fixture.CreateDbContext();
            var row = Assert.Single(await reload.MatchParticipations.AsNoTracking()
                .Where(mp => mp.EventId == seeded.EventId).ToListAsync());
            Assert.Equal(1, row.ScoreLocal);
            Assert.Equal(90, row.MinutesPlayed);
        }

        [Fact]
        public async Task Handle_SecondHalfWithPlayers_ClosesStateAsFinished()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(SecondHalfState(seeded.EventId, seeded.TeamId));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(FinishCommand(seeded.EventId, seeded.CoachId, 4, Finisher(seeded.TeamPlayerId)), CancellationToken.None);

            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.Equal(LiveMatchPhases.Finished, stored.Phase);
            Assert.NotNull(stored.ClosedAtUtc);
        }

        [Fact]
        public async Task Handle_StoredRedCard_CreatesSameAutomaticSanctionAsDirectSave()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            var state = SecondHalfState(seeded.EventId, seeded.TeamId);
            var cardsJson = $"[{{\"teamPlayerId\":\"{seeded.TeamPlayerId}\",\"cardType\":\"Red\"}}]";
            state.Apply(
                Input(LiveMatchActionTypes.Card, documents: new LiveMatchDocuments(null, null, null, null, null, cardsJson, null)),
                KickOffAt.AddMinutes(75),
                "seed");
            db.LiveMatchStates.Add(state);
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(FinishCommand(seeded.EventId, seeded.CoachId, 5, Finisher(seeded.TeamPlayerId)), CancellationToken.None);

            await using var reload = _fixture.CreateDbContext();
            var sanctions = await reload.TeamPlayerSanctions.AsNoTracking()
                .Where(s => s.TeamPlayerId == seeded.TeamPlayerId).ToListAsync();
            var sanction = Assert.Single(sanctions);
            Assert.True(sanction.IsAutomatic);
            Assert.Equal("Tarjeta roja", sanction.SanctionType);
            Assert.Equal(seeded.EventId, sanction.SourceEventId);
        }

        [Fact]
        public async Task Handle_WriterFails_LeavesNoParticipationAndStateOpenAtSameVersion()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(SecondHalfState(seeded.EventId, seeded.TeamId));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            // A TeamPlayerId longer than the column allows makes the writer's save fail after the first row was staged.
            var tooLongId = new string('x', 300);

            await Assert.ThrowsAnyAsync<Exception>(() => handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 4, Finisher(seeded.TeamPlayerId), Finisher(tooLongId)),
                CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var participations = await reload.MatchParticipations.AsNoTracking()
                .Where(mp => mp.EventId == seeded.EventId).CountAsync();
            Assert.Equal(0, participations);
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.False(stored.IsClosed);
            Assert.Equal(4, stored.Version);
        }

        [Fact]
        public async Task Handle_SanctionInsertFailsAfterParticipationStaged_RollsBackParticipationAndKeepsStateOpen()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            // No TeamPlayer has this id: MatchParticipation has no FK, so the writer's first save stages the row,
            // while the automatic sanction insert violates TeamPlayerSanction's FK to TeamPlayer.
            var missingTeamPlayerId = $"missing-teamplayer-{Guid.NewGuid():N}";
            var state = SecondHalfState(seeded.EventId, seeded.TeamId);
            var cardsJson = $"[{{\"teamPlayerId\":\"{missingTeamPlayerId}\",\"cardType\":\"Red\"}}]";
            state.Apply(
                Input(LiveMatchActionTypes.Card, documents: new LiveMatchDocuments(null, null, null, null, null, cardsJson, null)),
                KickOffAt.AddMinutes(75),
                "seed");
            db.LiveMatchStates.Add(state);
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAnyAsync<DbUpdateException>(() => handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 5, Finisher(missingTeamPlayerId)),
                CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var participations = await reload.MatchParticipations.AsNoTracking()
                .CountAsync(mp => mp.EventId == seeded.EventId);
            Assert.Equal(0, participations);
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.Equal(LiveMatchPhases.SecondHalf, stored.Phase);
            Assert.False(stored.IsClosed);
            Assert.Equal(5, stored.Version);
            broadcaster.Verify(b => b.BroadcastUpdatedAsync(It.IsAny<string>(), It.IsAny<LiveMatchStateResponse>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_Finished_BroadcastsOnceWithFinishedPhase()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(SecondHalfState(seeded.EventId, seeded.TeamId));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await handler.Handle(FinishCommand(seeded.EventId, seeded.CoachId, 4, Finisher(seeded.TeamPlayerId)), CancellationToken.None);

            broadcaster.Verify(b => b.BroadcastUpdatedAsync(
                seeded.EventId,
                It.Is<LiveMatchStateResponse>(s => s.Phase == LiveMatchPhases.Finished),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_ActionAfterFinish_ReturnsConflictWithClosedState()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(SecondHalfState(seeded.EventId, seeded.TeamId));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var finishHandler = new FinishLiveMatch.Handler(db, broadcaster.Object);
            var finish = await finishHandler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 4, Finisher(seeded.TeamPlayerId)), CancellationToken.None);
            Assert.False(finish.Conflict);

            await using var actionDb = _fixture.CreateDbContext();
            var actionHandler = new ApplyLiveMatchAction.Handler(actionDb, broadcaster.Object);
            var action = await actionHandler.Handle(new ApplyLiveMatchAction.ApplyLiveMatchActionCommand(
                seeded.EventId, seeded.CoachId,
                new ApplyLiveMatchAction.ApplyLiveMatchActionRequest(LiveMatchActionTypes.Goal, 4,
                    new ApplyLiveMatchAction.ActionPayload(null, null, null, 2, 0, null))), CancellationToken.None);

            Assert.True(action.Conflict);
            Assert.Equal(LiveMatchPhases.Finished, action.State.Phase);
        }

        [Fact]
        public async Task Handle_ObsoleteBaseVersion_ReturnsConflictAndChangesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            var state = SecondHalfState(seeded.EventId, seeded.TeamId);
            state.Apply(Input(LiveMatchActionTypes.Goal, scoreLocal: 1), KickOffAt.AddMinutes(70), "seed");
            db.LiveMatchStates.Add(state);
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            var result = await handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 4, Finisher(seeded.TeamPlayerId)), CancellationToken.None);

            Assert.True(result.Conflict);
            Assert.Equal(5, result.State.Version);
            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.Equal(LiveMatchPhases.SecondHalf, stored.Phase);
            Assert.Equal(0, await reload.MatchParticipations.AsNoTracking().CountAsync(mp => mp.EventId == seeded.EventId));
            broadcaster.Verify(b => b.BroadcastUpdatedAsync(It.IsAny<string>(), It.IsAny<LiveMatchStateResponse>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_FromPreMatch_ThrowsDomainExceptionAndChangesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(LiveMatchState.Create(seeded.EventId, seeded.TeamId, 60, KickOffAt, "seed"));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<DomainException>(() => handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 1, Finisher(seeded.TeamPlayerId)), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.Equal(LiveMatchPhases.PreMatch, stored.Phase);
            Assert.Equal(1, stored.Version);
        }

        [Fact]
        public async Task Handle_NonCoach_ThrowsForbiddenAndChangesNothing()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            db.LiveMatchStates.Add(SecondHalfState(seeded.EventId, seeded.TeamId));
            await db.SaveChangesAsync();
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(
                FinishCommand(seeded.EventId, seeded.OutsiderId, 4, Finisher(seeded.TeamPlayerId)), CancellationToken.None).AsTask());

            await using var reload = _fixture.CreateDbContext();
            var stored = await reload.LiveMatchStates.AsNoTracking().SingleAsync(s => s.EventId == seeded.EventId);
            Assert.False(stored.IsClosed);
        }

        [Fact]
        public async Task Handle_NoLiveState_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var seeded = await SeedMatchAsync(db);
            var broadcaster = new Mock<ILiveMatchBroadcaster>();
            var handler = new FinishLiveMatch.Handler(db, broadcaster.Object);

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
                FinishCommand(seeded.EventId, seeded.CoachId, 0, Finisher(seeded.TeamPlayerId)), CancellationToken.None).AsTask());
        }

        [Fact]
        public void Validator_EmptyPlayers_IsInvalid()
        {
            var validator = new FinishLiveMatch.Validator();

            var result = validator.Validate(FinishCommand("e1", "u1", 4));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_NegativeMinutesPlayed_IsInvalid()
        {
            var validator = new FinishLiveMatch.Validator();

            var result = validator.Validate(FinishCommand("e1", "u1", 4, Finisher("tp1", -5)));

            Assert.False(result.IsValid);
        }
    }
}
