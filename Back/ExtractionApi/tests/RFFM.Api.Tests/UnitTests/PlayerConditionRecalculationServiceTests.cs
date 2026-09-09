#nullable enable
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
    public class PlayerConditionRecalculationServiceTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

        public PlayerConditionRecalculationServiceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetTeamPlayerStatisticsHandlerTests.SeedTeamAsync.
        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Condition Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Condition Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(
            AppDbContext db, string teamId, string clubId, string seasonId, string alias, DateTime joinedDate)
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
                JoinedDate = joinedDate,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        // SportEvent.SetEveDateTime/SetStartTime reject past dates, so seed via CreateNew (bypasses
        // domain date validation) same as GetTeamPlayerStatisticsHandlerTests.SeedSportEventAsync.
        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "Condition Test Event",
                eveDateTime,
                eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task SeedMatchParticipationAsync(
            AppDbContext db, string eventId, string teamId, string teamPlayerId, int minutesPlayed)
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

        private async Task SeedConvocationAsync(
            AppDbContext db, string eventId, string teamPlayerId, int? assistanceTypeId, int? excuseTypeId = null)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = assistanceTypeId,
                ResponseDateTime = DateTime.UtcNow.AddDays(-1),
                ConvocationStatusId = null,
                ExcuseTypeId = excuseTypeId
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task NewPlayerWithNoEvents_FiveDaysAfterJoining_AppliesFiveDaysOfRestFromInitialValues()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var joinedDate = DateTime.UtcNow.Date.AddDays(-30);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-events-player", joinedDate);

            var asOfDate = joinedDate.AddDays(5);
            var service = new PlayerConditionRecalculationService(db);

            // Act
            var condition = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);

            // Assert: 5 days of rest (RestFitnessDelta/RestFatigueDelta per day) from 30/20.
            var expectedFitness = Math.Clamp(PlayerConditionDayEffect.InitialFitness + 5 * PlayerConditionDayEffect.RestFitnessDelta, 0, 100);
            var expectedFatigue = Math.Clamp(PlayerConditionDayEffect.InitialFatigue + 5 * PlayerConditionDayEffect.RestFatigueDelta, 0, 100);
            Assert.Equal(expectedFitness, condition.PhysicalFitness);
            Assert.Equal(expectedFatigue, condition.Fatigue);
            Assert.Equal(asOfDate, condition.LastCalculatedDate);
        }

        [Fact]
        public async Task ExistingCheckpointWithNewTraining_AppliesTrainingEffectOnlyOnThatDay()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var joinedDate = DateTime.UtcNow.Date.AddDays(-30);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "training-player", joinedDate);

            var service = new PlayerConditionRecalculationService(db);
            var checkpointDate = joinedDate.AddDays(2);
            await service.RecalculateAsync(teamPlayerId, checkpointDate, CancellationToken.None);

            var trainingDate = checkpointDate.AddDays(2); // 2nd of 3 days in the new range
            var trainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, trainingDate);
            await SeedConvocationAsync(db, trainingEventId, teamPlayerId, AssistanceType.Attendance.Id);

            var asOfDate = checkpointDate.AddDays(3);

            // Act
            var condition = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);

            // Assert: day1 rest, day2 training, day3 rest.
            var fitnessAfterCheckpoint = Math.Clamp(PlayerConditionDayEffect.InitialFitness + 2 * PlayerConditionDayEffect.RestFitnessDelta, 0, 100);
            var fatigueAfterCheckpoint = Math.Clamp(PlayerConditionDayEffect.InitialFatigue + 2 * PlayerConditionDayEffect.RestFatigueDelta, 0, 100);
            var expectedFitness = Math.Clamp(
                fitnessAfterCheckpoint + PlayerConditionDayEffect.RestFitnessDelta + PlayerConditionDayEffect.TrainingFitnessDelta + PlayerConditionDayEffect.RestFitnessDelta,
                0, 100);
            var expectedFatigue = Math.Clamp(
                fatigueAfterCheckpoint + PlayerConditionDayEffect.RestFatigueDelta + PlayerConditionDayEffect.TrainingFatigueDelta + PlayerConditionDayEffect.RestFatigueDelta,
                0, 100);
            Assert.Equal(expectedFitness, condition.PhysicalFitness);
            Assert.Equal(expectedFatigue, condition.Fatigue);
        }

        [Fact]
        public async Task MatchAndTrainingSameDay_OnlyMatchEffectApplies()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var joinedDate = DateTime.UtcNow.Date.AddDays(-10);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "match-and-training-player", joinedDate);

            var eventDate = joinedDate.AddDays(1);
            var trainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, eventDate);
            await SeedConvocationAsync(db, trainingEventId, teamPlayerId, AssistanceType.Attendance.Id);

            var matchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, eventDate);
            await SeedMatchParticipationAsync(db, matchEventId, teamId, teamPlayerId, minutesPlayed: 70);

            var service = new PlayerConditionRecalculationService(db);
            var asOfDate = joinedDate.AddDays(1);

            // Act
            var condition = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);

            // Assert: only the full-match effect applies for the single day in range, not training's.
            var expectedFitness = Math.Clamp(PlayerConditionDayEffect.InitialFitness + PlayerConditionDayEffect.FullMatchFitnessDelta, 0, 100);
            var expectedFatigue = Math.Clamp(PlayerConditionDayEffect.InitialFatigue + PlayerConditionDayEffect.FullMatchFatigueDelta, 0, 100);
            Assert.Equal(expectedFitness, condition.PhysicalFitness);
            Assert.Equal(expectedFatigue, condition.Fatigue);
        }

        [Fact]
        public async Task InjuryAbsenceDay_AppliesInjuryEffect_NotNormalRest()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var joinedDate = DateTime.UtcNow.Date.AddDays(-10);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "injury-player", joinedDate);

            var injuryDate = joinedDate.AddDays(1);
            var trainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, injuryDate);
            await SeedConvocationAsync(db, trainingEventId, teamPlayerId, assistanceTypeId: null, excuseTypeId: 1);

            var service = new PlayerConditionRecalculationService(db);
            var asOfDate = joinedDate.AddDays(1);

            // Act
            var condition = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);

            // Assert
            var expectedFitness = Math.Clamp(PlayerConditionDayEffect.InitialFitness + PlayerConditionDayEffect.InjuryRestFitnessDelta, 0, 100);
            var expectedFatigue = Math.Clamp(PlayerConditionDayEffect.InitialFatigue + PlayerConditionDayEffect.InjuryRestFatigueDelta, 0, 100);
            Assert.Equal(expectedFitness, condition.PhysicalFitness);
            Assert.Equal(expectedFatigue, condition.Fatigue);
        }

        [Fact]
        public async Task CallingTwiceWithSameAsOfDate_IsIdempotent()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var joinedDate = DateTime.UtcNow.Date.AddDays(-10);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "idempotent-player", joinedDate);

            var service = new PlayerConditionRecalculationService(db);
            var asOfDate = joinedDate.AddDays(3);

            // Act
            var first = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);
            var firstFitness = first.PhysicalFitness;
            var firstFatigue = first.Fatigue;

            var second = await service.RecalculateAsync(teamPlayerId, asOfDate, CancellationToken.None);

            // Assert
            Assert.Equal(firstFitness, second.PhysicalFitness);
            Assert.Equal(firstFatigue, second.Fatigue);
            Assert.Equal(asOfDate, second.LastCalculatedDate);
        }
    }
}
