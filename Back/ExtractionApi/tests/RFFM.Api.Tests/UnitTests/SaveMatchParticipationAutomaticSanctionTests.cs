#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers automatic sanction creation on SaveMatchParticipation (design.md Decisión 3,
    /// tasks.md sección 4): 5th cyclic yellow card and red card in a league match ("Partido")
    /// create a TeamPlayerSanction with IsAutomatic = true; friendlies don't; re-saving the same
    /// finished match doesn't duplicate the sanction.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SaveMatchParticipationAutomaticSanctionTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;

        public SaveMatchParticipationAutomaticSanctionTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"AutoSanction Test Club {Guid.NewGuid():N}", 1);
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
                Name = "AutoSanction Test Team",
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
                Alias = $"testplayer-{Guid.NewGuid():N}",
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

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "AutoSanction Test Event",
                eveDateTime, eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task SeedPriorYellowParticipationAsync(AppDbContext db, string teamId, string teamPlayerId, DateTime eveDateTime)
        {
            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, eveDateTime);
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}]";
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: 90, isStarter: true,
                enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0,
                matchPhase: "finished",
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: null,
                cardsJson: cardsJson);
            db.MatchParticipations.Add(participation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_FifthCyclicYellowInMatch_CreatesAutomaticSanction()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var baseDate = DateTime.UtcNow.AddDays(-20);
            for (var i = 0; i < 4; i++)
                await SeedPriorYellowParticipationAsync(db, teamId, teamPlayerId, baseDate.AddDays(i));

            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(10));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}]";

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 90, true, 0, null) },
                CardsJson = cardsJson
            };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var sanctions = await db.TeamPlayerSanctions
                .AsNoTracking()
                .Where(s => s.TeamPlayerId == teamPlayerId)
                .ToListAsync();

            var sanction = Assert.Single(sanctions);
            Assert.True(sanction.IsAutomatic);
            Assert.Equal("Amarillas acumuladas (5)", sanction.SanctionType);
            Assert.Equal(eventId, sanction.SourceEventId);
            Assert.Null(sanction.EndDate);
        }

        [Fact]
        public async Task Handle_FifthCyclicYellowInFriendlyMatch_DoesNotCreateSanction()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var baseDate = DateTime.UtcNow.AddDays(-20);
            for (var i = 0; i < 4; i++)
                await SeedPriorYellowParticipationAsync(db, teamId, teamPlayerId, baseDate.AddDays(i));

            var eventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baseDate.AddDays(10));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}]";

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 90, true, 0, null) },
                CardsJson = cardsJson
            };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var sanctions = await db.TeamPlayerSanctions.AsNoTracking().Where(s => s.TeamPlayerId == teamPlayerId).ToListAsync();
            Assert.Empty(sanctions);
        }

        [Fact]
        public async Task Handle_RedCardInMatch_CreatesAutomaticSanction()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Red\"}}]";

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 0,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 90, true, 0, null) },
                CardsJson = cardsJson
            };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var sanctions = await db.TeamPlayerSanctions.AsNoTracking().Where(s => s.TeamPlayerId == teamPlayerId).ToListAsync();
            var sanction = Assert.Single(sanctions);
            Assert.True(sanction.IsAutomatic);
            Assert.Equal("Tarjeta roja", sanction.SanctionType);
            Assert.Equal(eventId, sanction.SourceEventId);
        }

        [Fact]
        public async Task Handle_ResavingSameFinishedMatch_DoesNotDuplicateSanction()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Red\"}}]";

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 0,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 90, true, 0, null) },
                CardsJson = cardsJson
            };

            // Act — save the same finished match twice (e.g. coach re-edits and re-saves).
            await handler.Handle(request, CancellationToken.None);
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var sanctions = await db.TeamPlayerSanctions.AsNoTracking().Where(s => s.TeamPlayerId == teamPlayerId).ToListAsync();
            Assert.Single(sanctions);
        }
    }
}
