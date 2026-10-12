#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Formations;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Lineup;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// A match without a saved lineup starts from the lineup the previous match of the same
    /// category kicked off with.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetPreviousMatchLineupHandlerTests
    {
        private static readonly int LeagueEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        private static readonly DateTime MatchDay = new(2026, 10, 17, 10, 0, 0, DateTimeKind.Utc);

        private readonly PostgresContainerFixture _fixture;

        public GetPreviousMatchLineupHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"PreviousLineup Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "PreviousLineup Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = $"testplayer-{Guid.NewGuid():N}", ClubId = club.Id });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow, Dorsal = null, FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private static async Task<string> SeedEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime date)
        {
            var sportEvent = SportEvent.CreateNew("PreviousLineup Test Event", date, date, null, null, null, null, eventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private static async Task SeedPlayedMatchAsync(AppDbContext db, string eventId, string teamId, string teamPlayerId, string? startingLineupJson)
        {
            db.MatchParticipations.Add(MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: 90, isStarter: true,
                enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0,
                matchPhase: "finished",
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: null,
                startingLineupJson: startingLineupJson));
            await db.SaveChangesAsync();
        }

        private static async Task<string> SeedSavedLineupAsync(AppDbContext db, string eventId, string teamId, string teamPlayerId, int slotIndex)
        {
            var formation = Formation.Create($"T{Guid.NewGuid():N}"[..12]);
            db.Formations.Add(formation);
            await db.SaveChangesAsync();

            var lineup = TeamIdealLineup.Create(teamId, eventId, formation.Id);
            db.TeamIdealLineups.Add(lineup);
            await db.SaveChangesAsync();

            db.TeamIdealLineupSlots.Add(TeamIdealLineupSlot.Create(lineup.Id, slotIndex, teamPlayerId));
            await db.SaveChangesAsync();
            return formation.Id;
        }

        private static string StartingLineupJson(string formationId, string teamPlayerId, int slotIndex = 0)
            => $"{{\"formationId\":\"{formationId}\",\"formationName\":\"4-4-2\",\"slots\":{{\"{slotIndex}\":\"{teamPlayerId}\"}}}}";

        private static ValueTask<GetPreviousMatchLineup.PreviousMatchLineupDto?> HandleAsync(AppDbContext db, string teamId, string eventId)
            => new GetPreviousMatchLineup.Handler(db).Handle(new GetPreviousMatchLineup.GetPreviousMatchLineupQuery(teamId, eventId), CancellationToken.None);

        [Fact]
        public async Task Handle_PreviousMatchPlayedLive_ReturnsTheLineupItStartedWith()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, previousEventId, teamId, teamPlayerId, StartingLineupJson("f-started", teamPlayerId, slotIndex: 3));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.NotNull(result);
            Assert.Equal("f-started", result.FormationId);
            var slot = Assert.Single(result.Slots);
            Assert.Equal(3, slot.SlotIndex);
            Assert.Equal(teamPlayerId, slot.TeamPlayerId);
        }

        [Fact]
        public async Task Handle_PreviousMatchStartedWithALineupOtherThanTheSavedOne_PrefersTheOneItStartedWith()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            await SeedSavedLineupAsync(db, previousEventId, teamId, teamPlayerId, slotIndex: 1);
            await SeedPlayedMatchAsync(db, previousEventId, teamId, teamPlayerId, StartingLineupJson("f-started", teamPlayerId, slotIndex: 3));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Equal("f-started", result!.FormationId);
        }

        [Fact]
        public async Task Handle_PreviousMatchNotPlayedLive_ReturnsTheLineupSavedForIt()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            var savedFormationId = await SeedSavedLineupAsync(db, previousEventId, teamId, teamPlayerId, slotIndex: 2);
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.NotNull(result);
            Assert.Equal(savedFormationId, result.FormationId);
            var slot = Assert.Single(result.Slots);
            Assert.Equal(2, slot.SlotIndex);
            Assert.Equal(teamPlayerId, slot.TeamPlayerId);
        }

        [Fact]
        public async Task Handle_SeveralPreviousMatches_ReturnsTheMostRecentOne()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var olderEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-14));
            await SeedPlayedMatchAsync(db, olderEventId, teamId, teamPlayerId, StartingLineupJson("f-older", teamPlayerId));
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, previousEventId, teamId, teamPlayerId, StartingLineupJson("f-previous", teamPlayerId));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Equal("f-previous", result!.FormationId);
        }

        [Fact]
        public async Task Handle_PreviousMatchHasNoLineup_FallsBackToTheMostRecentOneThatHas()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var olderEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-14));
            await SeedPlayedMatchAsync(db, olderEventId, teamId, teamPlayerId, StartingLineupJson("f-older", teamPlayerId));
            await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Equal("f-older", result!.FormationId);
        }

        [Fact]
        public async Task Handle_LaterMatch_IsIgnored()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);
            var laterEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(7));
            await SeedPlayedMatchAsync(db, laterEventId, teamId, teamPlayerId, StartingLineupJson("f-later", teamPlayerId));

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_PreviousMatchOfAnotherCategory_IsIgnored()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var friendlyEventId = await SeedEventAsync(db, teamId, FriendlyEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, friendlyEventId, teamId, teamPlayerId, StartingLineupJson("f-friendly", teamPlayerId));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_PreviousMatchOfAnotherTeam_IsIgnored()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _) = await SeedTeamAndPlayerAsync(db);
            var (otherTeamId, otherTeamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var otherTeamEventId = await SeedEventAsync(db, otherTeamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, otherTeamEventId, otherTeamId, otherTeamPlayerId, StartingLineupJson("f-other-team", otherTeamPlayerId));
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_EventOfAnotherTeam_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var (otherTeamId, _) = await SeedTeamAndPlayerAsync(db);
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, previousEventId, teamId, teamPlayerId, StartingLineupJson("f-started", teamPlayerId));
            var otherTeamEventId = await SeedEventAsync(db, otherTeamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, otherTeamEventId);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_EventThatIsNotAMatch_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var previousTrainingId = await SeedEventAsync(db, teamId, TrainingEventTypeId, MatchDay.AddDays(-7));
            await SeedPlayedMatchAsync(db, previousTrainingId, teamId, teamPlayerId, StartingLineupJson("f-training", teamPlayerId));
            var trainingId = await SeedEventAsync(db, teamId, TrainingEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, trainingId);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_MalformedStartingLineup_FallsBackToTheLineupSavedForThatMatch()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var previousEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay.AddDays(-7));
            var savedFormationId = await SeedSavedLineupAsync(db, previousEventId, teamId, teamPlayerId, slotIndex: 2);
            await SeedPlayedMatchAsync(db, previousEventId, teamId, teamPlayerId, "{not-json");
            var currentEventId = await SeedEventAsync(db, teamId, LeagueEventTypeId, MatchDay);

            var result = await HandleAsync(db, teamId, currentEventId);

            Assert.Equal(savedFormationId, result!.FormationId);
        }
    }
}
