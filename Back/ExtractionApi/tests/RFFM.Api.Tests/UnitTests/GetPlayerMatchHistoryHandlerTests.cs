#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers the fields added to PlayerMatchRecordDto for player-card-tracking-and-suspensions
    /// (design.md Decisión 1, tasks.md sección 3): YellowCards/RedCards, RivalName, EventTypeId/
    /// EventTypeName, SubstitutionWindows.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetPlayerMatchHistoryHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;

        public GetPlayerMatchHistoryHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"MatchHistory Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "MatchHistory Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(AppDbContext db, string teamId, string clubId, string seasonId, string alias)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = alias,
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task<string> SeedRivalAsync(AppDbContext db, string name)
        {
            var rival = new Rival(name, null, null);
            db.Rivals.Add(rival);
            await db.SaveChangesAsync();
            return rival.Id;
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime, string? rivalId)
        {
            var sportEvent = SportEvent.CreateNew(
                "MatchHistory Test Event",
                eveDateTime, eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, rivalId);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task SeedMatchParticipationAsync(
            AppDbContext db, string eventId, string teamId, string teamPlayerId,
            string? cardsJson = null, string? substitutionWindowsJson = null)
        {
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: 90, isStarter: true,
                enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0,
                matchPhase: "finished",
                substitutionWindowsJson: substitutionWindowsJson,
                ratingSnapshotsJson: null,
                goalsJson: null,
                cardsJson: cardsJson);
            db.MatchParticipations.Add(participation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_TwoFinishedParticipations_ReturnsCardsRivalEventTypeAndSubstitutionWindows()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "match-history-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival");

            var cardsJson1 = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"yellow\"}}," +
                              $"{{\"teamPlayerId\":\"rival-player\",\"cardType\":\"yellow\",\"isRivalPlayer\":true}}]";
            var windowsJson1 = "[{\"windowIndex\":0,\"minute\":46,\"half\":2,\"swaps\":[{\"inPlayerId\":\"in-1\",\"outPlayerId\":\"" + teamPlayerId + "\",\"slotIndex\":0}]}," +
                                "{\"windowIndex\":1,\"minute\":70,\"half\":2,\"swaps\":[]}]";
            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedMatchParticipationAsync(db, event1, teamId, teamPlayerId, cardsJson: cardsJson1, substitutionWindowsJson: windowsJson1);

            var cardsJson2 = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"red\"}}]";
            var event2 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5), rivalId);
            await SeedMatchParticipationAsync(db, event2, teamId, teamPlayerId, cardsJson: cardsJson2);

            var handler = new GetPlayerMatchHistory.Handler(db);
            var query = new GetPlayerMatchHistory.PlayerMatchHistoryQuery { TeamPlayerId = teamPlayerId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Equal(2, result.Count);

            var record1 = Assert.Single(result, r => r.EventId == event1);
            Assert.NotNull(record1.MatchDate);
            Assert.Equal(1, record1.YellowCards);
            Assert.Equal(0, record1.RedCards);
            Assert.Equal("CD Rival", record1.RivalName);
            Assert.Equal(MatchEventTypeId, record1.EventTypeId);
            Assert.Equal("Partido", record1.EventTypeName);
            Assert.Equal(2, record1.SubstitutionWindows.Count);
            Assert.Equal(46, record1.SubstitutionWindows[0].Minute);
            var swap = Assert.Single(record1.SubstitutionWindows[0].Swaps);
            Assert.Equal(teamPlayerId, swap.OutPlayerId);

            var record2 = Assert.Single(result, r => r.EventId == event2);
            Assert.Equal(0, record2.YellowCards);
            Assert.Equal(1, record2.RedCards);
            Assert.Equal("CD Rival", record2.RivalName);
            Assert.Equal(FriendlyEventTypeId, record2.EventTypeId);
            Assert.Equal("Amistoso", record2.EventTypeName);
            Assert.Empty(record2.SubstitutionWindows);
        }

        [Fact]
        public async Task Handle_TwoFinishedParticipations_OrdersByMatchDateDescendingAndReturnsExactMatchDate()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "match-date-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival Date");

            var olderDate = DateTime.UtcNow.AddDays(-20).Date;
            var newerDate = DateTime.UtcNow.AddDays(-3).Date;

            var olderEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, olderDate, rivalId);
            await SeedMatchParticipationAsync(db, olderEvent, teamId, teamPlayerId);

            var newerEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, newerDate, rivalId);
            await SeedMatchParticipationAsync(db, newerEvent, teamId, teamPlayerId);

            var handler = new GetPlayerMatchHistory.Handler(db);
            var query = new GetPlayerMatchHistory.PlayerMatchHistoryQuery { TeamPlayerId = teamPlayerId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert — most recent match first, MatchDate reflects the SportEvent's date, not the save timestamp
            Assert.Equal(2, result.Count);
            Assert.Equal(newerEvent, result[0].EventId);
            Assert.Equal(newerDate, result[0].MatchDate);
            Assert.Equal(olderEvent, result[1].EventId);
            Assert.Equal(olderDate, result[1].MatchDate);
        }

        [Fact]
        public async Task Handle_MalformedSubstitutionWindowsJson_ReturnsEmptyListInsteadOfThrowing()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "malformed-windows-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival 2");

            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1), rivalId);
            await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId, substitutionWindowsJson: "{not-a-valid-array}");

            var handler = new GetPlayerMatchHistory.Handler(db);
            var query = new GetPlayerMatchHistory.PlayerMatchHistoryQuery { TeamPlayerId = teamPlayerId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var record = Assert.Single(result);
            Assert.Empty(record.SubstitutionWindows);
        }
    }
}
