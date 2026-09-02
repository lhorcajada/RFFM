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
    public class GetMatchParticipationHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetMatchParticipationHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as SaveMatchParticipationHandlerTests.SeedTeamAndPlayerAsync.
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
        public async Task Handle_AfterSavingCardsAndFormationChanges_ReturnsBothFieldsUnchanged()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var cardsJson = $"[{{\"id\":\"c1\",\"minute\":30,\"half\":1,\"cardType\":\"yellow\",\"teamPlayerId\":\"{teamPlayerId}\",\"playerName\":\"Test Player\",\"isRivalPlayer\":false,\"rivalDorsal\":null}}]";
            var formationChangesJson = "[{\"id\":\"f1\",\"minute\":60,\"half\":2,\"formationId\":\"442\",\"formationName\":\"4-4-2\",\"slotsAfter\":{\"1\":\"tp1\"}}]";

            var saveHandler = new SaveMatchParticipation.Handler(db);
            var saveRequest = new SaveMatchParticipation.SaveMatchParticipationRequest
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
                CardsJson = cardsJson,
                FormationChangesJson = formationChangesJson
            };
            await saveHandler.Handle(saveRequest, CancellationToken.None);

            var getHandler = new GetMatchParticipation.Handler(db);
            var getQuery = new GetMatchParticipation.GetMatchParticipationQuery
            {
                EventId = eventId,
                TeamId = teamId
            };

            // Act
            var response = await getHandler.Handle(getQuery, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.Equal(cardsJson, response!.CardsJson);
            Assert.Equal(formationChangesJson, response.FormationChangesJson);
        }
    }
}
