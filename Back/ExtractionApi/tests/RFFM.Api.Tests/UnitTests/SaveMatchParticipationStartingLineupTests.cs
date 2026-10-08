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
    /// <summary>
    /// The live match save stores the starting lineup (formation + slots) so the match report can
    /// draw the pitch even if the event's lineup is edited later (openspec match-report D4).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SaveMatchParticipationStartingLineupTests
    {
        private const string LineupJson = "{\"formationId\":\"f1\",\"formationName\":\"4-4-2\",\"slots\":{\"0\":\"tp1\"}}";

        private readonly PostgresContainerFixture _fixture;

        public SaveMatchParticipationStartingLineupTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"StartingLineup Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "StartingLineup Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id });
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

        private static SaveMatchParticipation.SaveMatchParticipationRequest Request(string eventId, string teamId, string teamPlayerId, string? startingLineupJson)
            => new()
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 1,
                ScoreVisitor = 0,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 90, true, 0, null) },
                StartingLineupJson = startingLineupJson
            };

        [Fact]
        public async Task Handle_WithStartingLineup_PersistsIt()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            await new SaveMatchParticipation.Handler(db).Handle(Request(eventId, teamId, teamPlayerId, LineupJson), CancellationToken.None);

            var saved = await db.MatchParticipations.AsNoTracking().SingleAsync(mp => mp.EventId == eventId);
            Assert.Equal(LineupJson, saved.StartingLineupJson);
        }

        [Fact]
        public async Task Handle_UpdateWithoutStartingLineup_KeepsStoredLineup()
        {
            await using var db = _fixture.CreateDbContext();
            var eventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            await new SaveMatchParticipation.Handler(db).Handle(Request(eventId, teamId, teamPlayerId, LineupJson), CancellationToken.None);

            await using var updateDb = _fixture.CreateDbContext();
            await new SaveMatchParticipation.Handler(updateDb).Handle(Request(eventId, teamId, teamPlayerId, null), CancellationToken.None);

            await using var readDb = _fixture.CreateDbContext();
            var saved = await readDb.MatchParticipations.AsNoTracking().SingleAsync(mp => mp.EventId == eventId);
            Assert.Equal(LineupJson, saved.StartingLineupJson);
        }
    }
}
