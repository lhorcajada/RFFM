#nullable enable
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class PlayerConditionServiceTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

        public PlayerConditionServiceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"PlayerCondition Test Club {Guid.NewGuid():N}", 1);
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
                Name = "PlayerCondition Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(
            AppDbContext db, string teamId, string clubId, string seasonId, string alias, DateTime? leftDate = null)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"{alias}-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow.AddDays(-30),
                LeftDate = leftDate,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "PlayerCondition Test Event",
                eveDateTime,
                eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, null,
                trainingTypes: null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task SeedAttendedTrainingAsync(AppDbContext db, string eventId, string teamPlayerId)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = AssistanceType.Attendance.Id,
                ResponseDateTime = DateTime.UtcNow.AddDays(-1),
                ConvocationStatusId = null,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();
        }

        private async Task SeedMatchParticipationAsync(AppDbContext db, string eventId, string teamId, string teamPlayerId, int minutesPlayed)
        {
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: minutesPlayed, isStarter: true,
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

        [Fact]
        public async Task GetForTeamAsync_ReturnsFatigueEqualToCalculator_ForPlayerWithTrainingAndMatch()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-player");

            var today = DateTime.UtcNow.Date;
            var trainingDate = today.AddDays(-2);
            var matchDate = today.AddDays(-3);
            var trainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, trainingDate);
            var matchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, matchDate);
            await SeedAttendedTrainingAsync(db, trainingEventId, teamPlayerId);
            await SeedMatchParticipationAsync(db, matchEventId, teamId, teamPlayerId, minutesPlayed: 60);

            var expectedFatigue = PlayerFatigueCalculator.Calculate(
                new List<(string EventId, DateTime? EventDate, int DaysAgo, IReadOnlyList<string> TrainingTypes)>
                {
                    (trainingEventId, trainingDate, 2, new List<string>())
                },
                new List<(string EventId, DateTime? EventDate, int DaysAgo, int MinutesPlayed, int EventTypeId)>
                {
                    (matchEventId, matchDate, 3, 60, MatchEventTypeId)
                }).Fatigue;

            var service = new PlayerConditionService(db);
            var conditions = await service.GetForTeamAsync(teamId, CancellationToken.None);

            var condition = Assert.Single(conditions);
            Assert.Equal(teamPlayerId, condition.TeamPlayerId);
            Assert.Equal(expectedFatigue, condition.Fatigue);
        }

        [Fact]
        public async Task GetForTeamAsync_DoesNotReturnPlayerWhoLeftTheTeam()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var activePlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "active-player");
            await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "left-player", leftDate: DateTime.UtcNow.AddDays(-1));

            var service = new PlayerConditionService(db);
            var conditions = await service.GetForTeamAsync(teamId, CancellationToken.None);

            var condition = Assert.Single(conditions);
            Assert.Equal(activePlayerId, condition.TeamPlayerId);
        }
    }
}
