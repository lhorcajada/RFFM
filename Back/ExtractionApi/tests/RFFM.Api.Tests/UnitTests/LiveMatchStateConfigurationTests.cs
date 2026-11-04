#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.LiveMatches;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class LiveMatchStateConfigurationTests
    {
        private static readonly DateTime KickOffAt = new(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public LiveMatchStateConfigurationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static LiveMatchActionInput Action(
            string type,
            int? durationMinutes = null,
            int? deltaSeconds = null,
            string? formation = null,
            int? scoreLocal = null,
            int? scoreVisitor = null,
            LiveMatchDocuments? documents = null) =>
            new(type, durationMinutes, deltaSeconds, formation, scoreLocal, scoreVisitor, documents);

        [Fact]
        public async Task Save_SecondStateForSameEvent_IsRejectedByUniqueIndex()
        {
            var eventId = Guid.NewGuid().ToString();
            await using (var first = _fixture.CreateDbContext())
            {
                first.LiveMatchStates.Add(LiveMatchState.Create(eventId, "team-1", 60, KickOffAt, "u1"));
                await first.SaveChangesAsync();
            }

            await using var second = _fixture.CreateDbContext();
            second.LiveMatchStates.Add(LiveMatchState.Create(eventId, "team-1", 60, KickOffAt, "u1"));

            await Assert.ThrowsAsync<DbUpdateException>(() => second.SaveChangesAsync());
        }

        [Fact]
        public async Task Save_TwoActionsOnSameVersion_SecondSaveRaisesConcurrencyConflict()
        {
            var eventId = Guid.NewGuid().ToString();
            await using (var seed = _fixture.CreateDbContext())
            {
                seed.LiveMatchStates.Add(LiveMatchState.Create(eventId, "team-1", 60, KickOffAt, "u1"));
                await seed.SaveChangesAsync();
            }

            await using var firstContext = _fixture.CreateDbContext();
            await using var secondContext = _fixture.CreateDbContext();
            var firstLoaded = await firstContext.LiveMatchStates.FirstOrDefaultAsync(s => s.EventId == eventId);
            var secondLoaded = await secondContext.LiveMatchStates.FirstOrDefaultAsync(s => s.EventId == eventId);
            Assert.NotNull(firstLoaded);
            Assert.NotNull(secondLoaded);

            firstLoaded!.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");
            await firstContext.SaveChangesAsync();

            secondLoaded!.Apply(Action(LiveMatchActionTypes.SetDuration, durationMinutes: 70), KickOffAt, "u2");
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => secondContext.SaveChangesAsync());
        }

        [Fact]
        public async Task Save_ReloadedState_KeepsPhaseClockScoreAndFormation()
        {
            var eventId = Guid.NewGuid().ToString();
            await using (var db = _fixture.CreateDbContext())
            {
                var state = LiveMatchState.Create(eventId, "team-1", 60, KickOffAt, "u1");
                state.Apply(Action(LiveMatchActionTypes.SetLineup, formation: "4-4-2"), KickOffAt, "u1");
                state.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");
                state.Apply(Action(LiveMatchActionTypes.Goal, scoreLocal: 1, scoreVisitor: 0), KickOffAt.AddSeconds(600), "u1");
                db.LiveMatchStates.Add(state);
                await db.SaveChangesAsync();
            }

            await using var reload = _fixture.CreateDbContext();
            var loaded = await reload.LiveMatchStates.AsNoTracking().FirstOrDefaultAsync(s => s.EventId == eventId);

            Assert.NotNull(loaded);
            Assert.Equal(LiveMatchPhases.FirstHalf, loaded!.Phase);
            Assert.Equal(0, loaded.ClockBaseSeconds);
            Assert.Equal(KickOffAt, loaded.ClockReferenceUtc);
            Assert.Equal(1, loaded.ScoreLocal);
            Assert.Equal(0, loaded.ScoreVisitor);
            Assert.Equal("4-4-2", loaded.Formation);
        }

        [Fact]
        public async Task Save_ReloadedState_KeepsAllSevenJsonDocumentsByteForByte()
        {
            var eventId = Guid.NewGuid().ToString();
            const string startingLineup = "[\"p1\",\"p2\",\"p3\"]";
            const string players = "[{\"teamPlayerId\":\"p1\",\"minutesPlayed\":90}]";
            const string substitutionWindows = "[{\"minute\":45,\"out\":\"p2\",\"in\":\"p4\"}]";
            const string ratingSnapshots = "[{\"teamPlayerId\":\"p1\",\"rating\":7.5}]";
            const string goals = "[{\"minute\":12,\"teamPlayerId\":\"p1\"}]";
            const string cards = "[{\"minute\":30,\"teamPlayerId\":\"p3\",\"cardType\":\"Yellow\"}]";
            const string formationChanges = "[{\"minute\":60,\"formation\":\"4-3-3\"}]";

            await using (var db = _fixture.CreateDbContext())
            {
                var state = LiveMatchState.Create(eventId, "team-1", 60, KickOffAt, "u1");
                state.Apply(
                    Action(LiveMatchActionTypes.SetLineup, documents: new LiveMatchDocuments(startingLineup, players, null, null, null, null, null)),
                    KickOffAt,
                    "u1");
                state.Apply(Action(LiveMatchActionTypes.KickOff), KickOffAt, "u1");
                state.Apply(
                    Action(LiveMatchActionTypes.Substitution, documents: new LiveMatchDocuments(null, null, substitutionWindows, ratingSnapshots, null, null, null)),
                    KickOffAt.AddSeconds(2700),
                    "u1");
                state.Apply(
                    Action(LiveMatchActionTypes.Goal, scoreLocal: 1, scoreVisitor: 0, documents: new LiveMatchDocuments(null, null, null, null, goals, null, null)),
                    KickOffAt.AddSeconds(720),
                    "u1");
                state.Apply(
                    Action(LiveMatchActionTypes.Card, documents: new LiveMatchDocuments(null, null, null, null, null, cards, null)),
                    KickOffAt.AddSeconds(1800),
                    "u1");
                state.Apply(
                    Action(LiveMatchActionTypes.FormationChange, formation: "4-3-3", documents: new LiveMatchDocuments(null, null, null, null, null, null, formationChanges)),
                    KickOffAt.AddSeconds(3600),
                    "u1");
                db.LiveMatchStates.Add(state);
                await db.SaveChangesAsync();
            }

            await using var reload = _fixture.CreateDbContext();
            var loaded = await reload.LiveMatchStates.AsNoTracking().FirstOrDefaultAsync(s => s.EventId == eventId);

            Assert.NotNull(loaded);
            Assert.Equal(startingLineup, loaded!.Documents.StartingLineupJson);
            Assert.Equal(players, loaded.Documents.PlayersJson);
            Assert.Equal(substitutionWindows, loaded.Documents.SubstitutionWindowsJson);
            Assert.Equal(ratingSnapshots, loaded.Documents.RatingSnapshotsJson);
            Assert.Equal(goals, loaded.Documents.GoalsJson);
            Assert.Equal(cards, loaded.Documents.CardsJson);
            Assert.Equal(formationChanges, loaded.Documents.FormationChangesJson);
        }
    }
}
