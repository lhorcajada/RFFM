#nullable enable
using Microsoft.EntityFrameworkCore;
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
    [Collection(PostgresCollection.Name)]
    public class SaveMatchParticipationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SaveMatchParticipationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetEventAttendanceRosterHandlerTests.SeedTeamAndPlayerAsync.
        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"MatchParticipation Test Club {Guid.NewGuid():N}", 1);
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
                Name = "MatchParticipation Test Team",
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

        [Fact]
        public async Task Handle_CreateWithCardsJson_PersistsCardsJson()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var handler = new SaveMatchParticipation.Handler(db);
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}]";
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto>
                {
                    new(teamPlayerId, 90, true, 0, null)
                },
                CardsJson = cardsJson
            };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var saved = await db.MatchParticipations
                .AsNoTracking()
                .FirstOrDefaultAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);

            Assert.NotNull(saved);
            Assert.Equal(cardsJson, saved!.CardsJson);
        }

        [Fact]
        public async Task Handle_CreateWithoutCardsJson_LeavesCardsJsonNull()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var handler = new SaveMatchParticipation.Handler(db);
            var request = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 0,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto>
                {
                    new(teamPlayerId, 90, true, 0, null)
                }
            };

            // Act
            await handler.Handle(request, CancellationToken.None);

            // Assert
            var saved = await db.MatchParticipations
                .AsNoTracking()
                .FirstOrDefaultAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);

            Assert.NotNull(saved);
            Assert.Null(saved!.CardsJson);
        }

        [Fact]
        public async Task Handle_UpdateExistingRecordWithCardsJson_PersistsCardsJson()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var handler = new SaveMatchParticipation.Handler(db);
            var initialRequest = new SaveMatchParticipation.SaveMatchParticipationRequest
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 0,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto>
                {
                    new(teamPlayerId, 45, true, 0, null)
                }
            };
            await handler.Handle(initialRequest, CancellationToken.None);

            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Red\"}}]";
            var updateRequest = initialRequest with
            {
                Players = new List<SaveMatchParticipation.PlayerParticipationDto>
                {
                    new(teamPlayerId, 90, true, 0, null)
                },
                CardsJson = cardsJson
            };

            // Act
            await handler.Handle(updateRequest, CancellationToken.None);

            // Assert
            var saved = await db.MatchParticipations
                .AsNoTracking()
                .FirstOrDefaultAsync(mp => mp.EventId == eventId && mp.TeamPlayerId == teamPlayerId);

            Assert.NotNull(saved);
            Assert.Equal(cardsJson, saved!.CardsJson);
            Assert.Equal(90, saved.MinutesPlayed);
        }
    }
}
