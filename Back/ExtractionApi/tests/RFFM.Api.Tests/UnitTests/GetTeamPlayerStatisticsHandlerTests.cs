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
using RFFM.Api.Features.Coaches.Players.Services;
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
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

        public GetTeamPlayerStatisticsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetPlayerSeasonCardsHandlerTests.SeedTeamAsync.
        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db, int? categoryId = null)
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
                CategoryId = categoryId ?? Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(
            AppDbContext db, string teamId, string clubId, string seasonId, string alias,
            DateTime? joinedDate = null)
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
                JoinedDate = joinedDate ?? DateTime.UtcNow,
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

        private async Task SeedConvocationAsync(AppDbContext db, string eventId, string teamPlayerId, int? convocationStatusId, int? assistanceTypeId = null, int? excuseTypeId = null)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = assistanceTypeId,
                ResponseDateTime = DateTime.UtcNow.AddDays(-1),
                ConvocationStatusId = convocationStatusId,
                ExcuseTypeId = excuseTypeId
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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
        public async Task PlayerWithFriendlyMatchMinutes_CountsTowardReadinessMatchComponent()
        {
            // Regression: a friendly ("Amistoso") is real physical exertion and must count
            // toward Rodaje's match component, even though it's excluded elsewhere (season
            // discipline counters) as an official match. Before the fix, the windowed match
            // query only looked at EventTypeId == Partido, silently dropping friendly minutes.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "friendly-player");

            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, minutesPlayed: 65);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.NotNull(stats.ReadinessBreakdown);
            Assert.Equal(65, stats.ReadinessBreakdown!.MatchMinutesInWindow);
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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

        [Fact]
        public async Task NewPlayerWithNoActivity_PhysicalConditionDefaultsToInitialValues()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "condition-default-player");

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(PlayerConditionDayEffect.InitialFitness, stats.PhysicalFitness);
            Assert.Equal(PlayerConditionDayEffect.InitialFatigue, stats.Fatigue);
            Assert.Equal(
                PlayerConditionDayEffect.InitialFitness - PlayerConditionDayEffect.InitialFatigue,
                stats.Availability);
        }

        [Fact]
        public async Task Availability_IsNeverNegative_WhenFatigueExceedsPhysicalFitness()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "high-fatigue-player");

            var condition = TeamPlayerCondition.CreateInitial(teamPlayerId, DateTime.UtcNow.Date);
            condition.Advance(fitnessDelta: 0, fatigueDelta: 100, newDate: DateTime.UtcNow.Date);
            db.TeamPlayerConditions.Add(condition);
            await db.SaveChangesAsync();

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.True(stats.Fatigue > stats.PhysicalFitness);
            Assert.Equal(0, stats.Availability);
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
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

            // Use fixed baseline to avoid timing issues
            var baselineDate = new DateTime(2025, 1, 1, 12, 0, 0, DateTimeKind.Utc);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "full-history-player",
                joinedDate: baselineDate.AddYears(-1));

            // Training 10 weeks ago (outside the 8-week form-status window) — attended.
            var oldTrainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-70));
            await SeedConvocationAsync(db, oldTrainingEventId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Late arrival, also old — still counts as attended.
            var oldTrainingEventId2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-63));
            await SeedConvocationAsync(db, oldTrainingEventId2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.LateArrival.Id);

            // Recent training within the window — attended.
            var recentTrainingEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-3));
            await SeedConvocationAsync(db, recentTrainingEventId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Match 10 weeks ago (outside the window) — finished.
            var oldMatchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baselineDate.AddDays(-70));
            await SeedMatchParticipationAsync(db, oldMatchEventId, teamId, teamPlayerId);

            // Match within the window — finished.
            var recentMatchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baselineDate.AddDays(-3));
            await SeedMatchParticipationAsync(db, recentMatchEventId, teamId, teamPlayerId);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // 3 trainings attended (full season history, not just window)
            Assert.Equal(3, stats.Trainings.Attended);
            Assert.Equal(3, stats.Trainings.Possible);
            // 2 league matches played (full season history)
            Assert.Equal(2, stats.League.Attended);
            Assert.Equal(2, stats.League.Possible);
        }

        [Fact]
        public async Task AttendanceRatio_FinishedVsFutureEvents_OnlyFinishedCountTowardPossible()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "finished-vs-future-player",
                joinedDate: DateTime.UtcNow.AddYears(-1));

            // Finished training (clearly in the past relative to real UtcNow) — attended
            var finishedTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedConvocationAsync(db, finishedTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Future training (clearly in the future relative to real UtcNow) — should NOT count toward possible
            var futureTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(5));
            await SeedConvocationAsync(db, futureTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, stats.Trainings.Attended);
            Assert.Equal(1, stats.Trainings.Possible);  // only finished event counts
        }

        [Fact]
        public async Task AttendanceRatio_PlayerJoinedAfterEvent_ExcludesPreJoinEventsFromPossible()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);

            // Create player but don't use SeedTeamPlayerAsync — manually set JoinedDate to after first event
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Late",
                LastName = "Joiner",
                Alias = $"late-join-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            // Use fixed baseline to avoid timing issues
            var baselineDate = new DateTime(2025, 1, 1, 12, 0, 0, DateTimeKind.Utc);
            var joinedDate = baselineDate.AddDays(-10);  // Will join after first event
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

            // Event before player joined (20 days ago) — should NOT count toward possible
            var preJoinEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-20));
            await SeedConvocationAsync(db, preJoinEventId, teamPlayer.Id, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Event after player joined (5 days ago) — should count toward possible
            var postJoinEventId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-5));
            await SeedConvocationAsync(db, postJoinEventId, teamPlayer.Id, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayer.Id);
            Assert.Equal(1, stats.Trainings.Attended);
            Assert.Equal(1, stats.Trainings.Possible);  // only post-join event counts
        }

        [Fact]
        public async Task AttendanceRatio_ByEventType_TracksTrainigsFriendliesLeagueIndependently()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);

            // Use fixed baseline to avoid timing issues
            var baselineDate = new DateTime(2025, 1, 1, 12, 0, 0, DateTimeKind.Utc);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "multi-event-player",
                joinedDate: baselineDate.AddYears(-1));

            // Trainings: 2 attended, 1 absent, 1 late = 2 attended, 4 possible
            var t1 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-5));
            await SeedConvocationAsync(db, t1, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var t2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-4));
            await SeedConvocationAsync(db, t2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.LateArrival.Id);

            var t3 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-3));
            await SeedConvocationAsync(db, t3, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.ExcusedAbsence.Id);

            var t4 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baselineDate.AddDays(-2));
            await SeedConvocationAsync(db, t4, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            // Friendlies: 1 attended (via participation), 1 not called = 1 attended, 2 possible
            var f1 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baselineDate.AddDays(-5));
            await SeedMatchParticipationAsync(db, f1, teamId, teamPlayerId, minutesPlayed: 45);

            var f2 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baselineDate.AddDays(-4));
            // No convocation/participation for f2 = not called, still counts as possible

            // Called up but absent for a friendly — counts as possible + calledButAbsent, not attended.
            var f3 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baselineDate.AddDays(-3));
            await SeedConvocationAsync(db, f3, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            // League: 1 attended via participation = 1 attended, 1 possible
            var l1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baselineDate.AddDays(-5));
            await SeedMatchParticipationAsync(db, l1, teamId, teamPlayerId, minutesPlayed: 90);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(2, stats.Trainings.Attended);
            Assert.Equal(4, stats.Trainings.Possible);
            Assert.Equal(2, stats.Trainings.CalledButAbsent);
            Assert.Equal(1, stats.Friendlies.Attended);
            Assert.Equal(3, stats.Friendlies.Possible);
            Assert.Equal(1, stats.Friendlies.CalledButAbsent);
            Assert.Equal(1, stats.League.Attended);
            Assert.Equal(1, stats.League.Possible);
            Assert.Equal(0, stats.League.CalledButAbsent);
        }

        [Fact]
        public async Task AttendanceRatio_MatchWithBothConvocationAndParticipation_CountsAttendanceOnce()
        {
            // Arrange: a match event commonly has BOTH a Convocation(Attendance) row (from the
            // convocation flow) AND a MatchParticipation row (from recording the match) for the
            // same player — attendance must be deduplicated per event id, otherwise "Attended"
            // can exceed "Possible" (regression: real data showed "3 de 2 amistosos").
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "double-counted-player",
                joinedDate: DateTime.UtcNow.AddYears(-1));

            var f1 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-10));
            await SeedConvocationAsync(db, f1, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            await SeedMatchParticipationAsync(db, f1, teamId, teamPlayerId, minutesPlayed: 45);

            var f2 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedConvocationAsync(db, f2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            await SeedMatchParticipationAsync(db, f2, teamId, teamPlayerId, minutesPlayed: 45);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(2, stats.Friendlies.Attended);
            Assert.Equal(2, stats.Friendlies.Possible);
        }

        [Fact]
        public async Task MinutesTarget_F11Team_CapsMatchDurationAtStandardAndComputesPercentages()
        {
            // Arrange: Youth (Juveniles) category → 45' standard F11 match duration.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.Youth.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-target-player");

            // Official match: player plays the full 45' standard duration.
            var matchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10));
            await SeedMatchParticipationAsync(db, matchEventId, teamId, teamPlayerId, minutesPlayed: 45);

            // Friendly: shorter than standard (20') — real duration should cap the contribution,
            // not the 45' category standard.
            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, minutesPlayed: 20);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // SeasonTotalPossibleMinutes = min(45,45) + min(45,20) = 45 + 20 = 65.
            // Player played 45 + 20 = 65 minutes → 100% of the season total.
            Assert.Equal(65, stats.MinutesPlayed);
            Assert.Equal(100.0, stats.MinutesPlayedPercentOfSeasonTotal);
            Assert.Equal(0, stats.MatchesAbsentAttributableToPlayer);
            Assert.Equal(0.0, stats.AttributableAbsentMinutesPercentOfSeasonTotal);
        }

        [Fact]
        public async Task AttendanceRatio_DeconvokedForNonTechnicalReason_CountsAsCalledButAbsent()
        {
            // Regression: real data showed "0 de 2" friendlies with only "1 convocado, no asistió"
            // even though BOTH friendlies were attributable to the player — one was a no-show on
            // the day (ExcusedAbsence) and the other was deconvoked for a family event (not the
            // coach's technical decision). Both must count toward CalledButAbsent.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var baselineDate = new DateTime(2025, 1, 1, 12, 0, 0, DateTimeKind.Utc);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "deconvoked-non-technical-player",
                joinedDate: baselineDate.AddYears(-1));

            var f1 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baselineDate.AddDays(-10));
            await SeedConvocationAsync(db, f1, teamPlayerId, convocationStatusId: ConvocationStatus.FromName("Deconvoke").Id,
                assistanceTypeId: null, excuseTypeId: ExcuseTypes.FamilyEvent.Id);

            var f2 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, baselineDate.AddDays(-5));
            await SeedConvocationAsync(db, f2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.ExcusedAbsence.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(0, stats.Friendlies.Attended);
            Assert.Equal(2, stats.Friendlies.Possible);
            Assert.Equal(2, stats.Friendlies.CalledButAbsent);
        }

        [Fact]
        public async Task MinutesTarget_F11Team_MatchLongerThanStandard_UsesRealDurationNotCapped()
        {
            // Arrange: Alevines category → 30' standard F11 match duration, but the match ran
            // to 40' (tiempo añadido/prórroga). The real registered duration must be used as the
            // season total's contribution, not the 30' standard — otherwise the denominator would
            // be capped below the player's own recorded minutes and the percentage would exceed
            // 100%, which is nonsensical (regression for that bug).
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U10.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "long-match-player");

            var matchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedMatchParticipationAsync(db, matchEventId, teamId, teamPlayerId, minutesPlayed: 40);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // SeasonTotalPossibleMinutes = real 40' (not capped to the 30' standard) → 100%, never > 100%.
            Assert.Equal(40, stats.MinutesPlayed);
            Assert.Equal(100.0, stats.MinutesPlayedPercentOfSeasonTotal);
        }

        [Fact]
        public async Task NonF11Team_MinutesTargetPercentagesAreNull_ButAttributableAbsencesStillComputed()
        {
            // Arrange: Amateurs (Aficionados) is not one of the 4 F11 categories.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.Amateurs.Id);

            var neverConvokedPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "never-convoked");
            var technicalDecisionPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "technical-decision");
            var injuryDeconvokedPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "injury-deconvoked");
            var noShowPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-show");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-20));
            // neverConvokedPlayerId: no Convocation row at all for any event → never called up.

            var event2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-15));
            await SeedConvocationAsync(db, event2, technicalDecisionPlayerId,
                convocationStatusId: ConvocationStatus.FromName("Deconvoke").Id,
                assistanceTypeId: null,
                excuseTypeId: ExcuseTypes.TechnicalDecision.Id);

            var event3 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10));
            await SeedConvocationAsync(db, event3, injuryDeconvokedPlayerId,
                convocationStatusId: ConvocationStatus.FromName("Deconvoke").Id,
                assistanceTypeId: null,
                excuseTypeId: 1 /* Lesión */);

            var event4 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedConvocationAsync(db, event4, noShowPlayerId,
                convocationStatusId: null,
                assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db, new PlayerConditionRecalculationService(db));
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var neverConvoked = Assert.Single(result, p => p.TeamPlayerId == neverConvokedPlayerId);
            Assert.Equal(0, neverConvoked.MatchesAbsentAttributableToPlayer);

            var technicalDecision = Assert.Single(result, p => p.TeamPlayerId == technicalDecisionPlayerId);
            Assert.Equal(0, technicalDecision.MatchesAbsentAttributableToPlayer);

            var injuryDeconvoked = Assert.Single(result, p => p.TeamPlayerId == injuryDeconvokedPlayerId);
            Assert.Equal(1, injuryDeconvoked.MatchesAbsentAttributableToPlayer);

            var noShow = Assert.Single(result, p => p.TeamPlayerId == noShowPlayerId);
            Assert.Equal(1, noShow.MatchesAbsentAttributableToPlayer);

            // Non-F11 category → both percent fields are null for every player, regardless of
            // MatchesAbsentAttributableToPlayer, which does not depend on category.
            foreach (var stats in result)
            {
                Assert.Null(stats.MinutesPlayedPercentOfSeasonTotal);
                Assert.Null(stats.AttributableAbsentMinutesPercentOfSeasonTotal);
            }
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
