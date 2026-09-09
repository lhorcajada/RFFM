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
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamPlayerStatisticsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

        public GetTeamPlayerStatisticsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetPlayerSeasonCardsHandlerTests.SeedTeamAsync.
        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"PlayerStats Test Club {Guid.NewGuid():N}", 1);
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
                Name = "PlayerStats Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(
            AppDbContext db, string teamId, string clubId, string seasonId, string alias)
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
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        // SportEvent.SetEveDateTime/SetStartTime reject past dates, so seed via CreateNew (bypasses
        // domain date validation) same as GetPlayerSeasonCardsHandlerTests.SeedSportEventAsync.
        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "PlayerStats Test Event",
                eveDateTime,
                eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task SeedMatchParticipationAsync(
            AppDbContext db, string eventId, string teamId, string teamPlayerId,
            int minutesPlayed = 90, bool isStarter = true, string? goalsJson = null, string? cardsJson = null, string matchPhase = "finished")
        {
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: minutesPlayed, isStarter: isStarter,
                enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0,
                matchPhase: matchPhase,
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: goalsJson,
                cardsJson: cardsJson);
            db.MatchParticipations.Add(participation);
            await db.SaveChangesAsync();
        }

        private async Task SeedConvocationAsync(AppDbContext db, string eventId, string teamPlayerId, int? convocationStatusId, int? assistanceTypeId = null)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = assistanceTypeId,
                ResponseDateTime = DateTime.UtcNow.AddDays(-1),
                ConvocationStatusId = convocationStatusId,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PlayerWithOldAndRecentActivity_SeasonTotalsIncludeAll_ReadinessOnlyUsesWindow()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "old-and-recent-player");

            // Match 10 weeks ago (outside the 8-week window)
            var oldEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-70));
            var oldGoalsJson = $"[{{\"scorerId\":\"{teamPlayerId}\",\"isOwnTeam\":true}}]";
            await SeedMatchParticipationAsync(db, oldEventId, teamId, teamPlayerId, minutesPlayed: 90, goalsJson: oldGoalsJson);

            // Match 1 week ago (inside the 8-week window)
            var recentEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-7));
            await SeedMatchParticipationAsync(db, recentEventId, teamId, teamPlayerId, minutesPlayed: 60);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, stats.Goals);
            Assert.Equal(150, stats.MinutesPlayed);
            Assert.NotNull(stats.ReadinessBreakdown);
            Assert.Equal(60, stats.ReadinessBreakdown!.MatchMinutesInWindow);
        }

        [Fact]
        public async Task PlayerWithYellowAndRedCards_CountsMatchPlayerCardCountService()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "carded-player");

            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}," +
                             $"{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Red\"}}]";
            await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId, cardsJson: cardsJson);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, stats.YellowCards);
            Assert.Equal(1, stats.RedCards);
        }

        [Fact]
        public async Task PlayerWithNoActivity_ReadinessIsNull_TotalsAreZero()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-activity-player");

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Null(stats.Readiness);
            Assert.Equal(0, stats.Goals);
            Assert.Equal(0, stats.YellowCards);
            Assert.Equal(0, stats.RedCards);
            Assert.Equal(0, stats.MinutesPlayed);
        }

        private async Task SeedInjuryAsync(
            AppDbContext db, string teamPlayerId, DateTime startDate, DateTime? endDate = null)
        {
            var injury = TeamPlayerInjury.Create(teamPlayerId, startDate, "Muscular", null, null);
            if (endDate.HasValue)
                injury.Update(startDate, "Muscular", null, null, endDate);
            db.TeamPlayerInjuries.Add(injury);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PlayerWithTwoInjuries_UsesMostRecentByStartDate()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "two-injuries-player");

            var olderStart = DateTime.UtcNow.AddDays(-100);
            var olderEnd = DateTime.UtcNow.AddDays(-90);
            await SeedInjuryAsync(db, teamPlayerId, olderStart, olderEnd);

            var recentStart = DateTime.UtcNow.AddDays(-20);
            var recentEnd = DateTime.UtcNow.AddDays(-10);
            await SeedInjuryAsync(db, teamPlayerId, recentStart, recentEnd);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            var expectedDaysSince = (int)(DateTime.UtcNow - recentStart).TotalDays;
            var expectedDuration = (int)(recentEnd - recentStart).TotalDays;
            Assert.Equal(expectedDaysSince, stats.DaysSinceLastInjury);
            Assert.Equal(expectedDuration, stats.LastInjuryDurationDays);
        }

        [Fact]
        public async Task PlayerWithActiveInjury_DurationIsNull_DaysSinceStillCalculated()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "active-injury-player");

            var startDate = DateTime.UtcNow.AddDays(-15);
            await SeedInjuryAsync(db, teamPlayerId, startDate, endDate: null);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            var expectedDaysSince = (int)(DateTime.UtcNow - startDate).TotalDays;
            Assert.Equal(expectedDaysSince, stats.DaysSinceLastInjury);
            Assert.Null(stats.LastInjuryDurationDays);
        }

        [Fact]
        public async Task PlayerWithNoInjury_InjuryFieldsAreNull()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-injury-player");

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Null(stats.DaysSinceLastInjury);
            Assert.Null(stats.LastInjuryDurationDays);
        }

        [Fact]
        public async Task TrainingsAttendedAndMatchesPlayed_ReflectFullSeasonHistory_NotJustReadinessWindow()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "full-history-player");

            // Training 10 weeks ago (outside the 8-week form-status window) — attended.
            var oldTrainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-70));
            await SeedConvocationAsync(db, oldTrainingEventId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Late arrival, also old — still counts as attended.
            var oldTrainingEventId2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-63));
            await SeedConvocationAsync(db, oldTrainingEventId2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.LateArrival.Id);

            // Recent training within the window — attended.
            var recentTrainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedConvocationAsync(db, recentTrainingEventId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Match 10 weeks ago (outside the window) — finished.
            var oldMatchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-70));
            await SeedMatchParticipationAsync(db, oldMatchEventId, teamId, teamPlayerId);

            // Match within the window — finished.
            var recentMatchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedMatchParticipationAsync(db, recentMatchEventId, teamId, teamPlayerId);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(3, stats.TrainingsAttended);
            Assert.Equal(2, stats.MatchesPlayed);
        }

        [Fact]
        public void Endpoint_RequiresTeamMembershipAndSquadReadPermission()
        {
            var query = new GetTeamPlayerStatistics.Query { TeamId = "some-team-id" };

            Assert.IsAssignableFrom<IRequireTeamMembership>(query);
            Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.Squad, ((IRequireFeaturePermission)query).FeatureRoute);
            Assert.Equal("Read", ((IRequireFeaturePermission)query).RequiredPermission);
            Assert.Equal("some-team-id", ((IRequireTeamMembership)query).TeamId);
        }
    }
}
