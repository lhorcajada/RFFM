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
    [Collection(PostgresCollection.Name)]
    public class MatchDurationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public MatchDurationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string TeamPlayerId, string EventId)> SeedMatchAsync(AppDbContext db)
        {
            var club = Club.Create($"MatchDuration Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "MatchDuration Test Team",
                CategoryId = Category.U14.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = $"duration-{Guid.NewGuid():N}", ClubId = club.Id });
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

            var matchDate = DateTime.UtcNow.AddDays(-1);
            var sportEvent = SportEvent.CreateNew("Duration Test Match", matchDate, matchDate, null, null, null, null,
                SportEventType.FromName("Partido").Id, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id, sportEvent.Id);
        }

        private static SaveMatchParticipation.SaveMatchParticipationRequest FinishedRequest(
            string eventId, string teamId, string teamPlayerId, int? durationMinutes) => new()
            {
                EventId = eventId,
                TeamId = teamId,
                ScoreLocal = 2,
                ScoreVisitor = 1,
                MatchPhase = "finished",
                Players = new List<SaveMatchParticipation.PlayerParticipationDto> { new(teamPlayerId, 50, true, 0, 50) },
                MatchDurationMinutes = durationMinutes
            };

        [Fact]
        public async Task Save_FinishedMatchWithDuration_StoresItOnTheEventAndGetReturnsIt()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, eventId) = await SeedMatchAsync(db);

            await new SaveMatchParticipation.Handler(db).Handle(FinishedRequest(eventId, teamId, teamPlayerId, 76), CancellationToken.None);

            var stored = await db.SportEvents.AsNoTracking().SingleAsync(se => se.Id == eventId);
            Assert.Equal(76, stored.MatchDurationMinutes);
            var response = await new GetMatchParticipation.Handler(db).Handle(
                new GetMatchParticipation.GetMatchParticipationQuery { EventId = eventId, TeamId = teamId }, CancellationToken.None);
            Assert.Equal(76, response!.MatchDurationMinutes);
        }

        [Fact]
        public async Task Save_WithoutDuration_KeepsThePreviouslyStoredValue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, eventId) = await SeedMatchAsync(db);
            var handler = new SaveMatchParticipation.Handler(db);

            await handler.Handle(FinishedRequest(eventId, teamId, teamPlayerId, 76), CancellationToken.None);
            await handler.Handle(FinishedRequest(eventId, teamId, teamPlayerId, null), CancellationToken.None);

            var stored = await db.SportEvents.AsNoTracking().SingleAsync(se => se.Id == eventId);
            Assert.Equal(76, stored.MatchDurationMinutes);
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(201)]
        public void Validator_RejectsDurationOutOfRange(int duration)
        {
            var result = new SaveMatchParticipation.Validator().Validate(FinishedRequest("e", "t", "p", duration));

            Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveMatchParticipation.SaveMatchParticipationRequest.MatchDurationMinutes));
        }

        [Theory]
        [InlineData(null)]
        [InlineData(0)]
        [InlineData(80)]
        [InlineData(200)]
        public void Validator_AcceptsMissingOrInRangeDuration(int? duration)
        {
            var result = new SaveMatchParticipation.Validator().Validate(FinishedRequest("e", "t", "p", duration));

            Assert.True(result.IsValid);
        }
    }
}
