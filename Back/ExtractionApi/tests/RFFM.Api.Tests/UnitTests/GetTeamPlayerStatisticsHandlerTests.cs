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
        // trainingTypes defaults to null (empty list) — retrocompat, peso neutro para las tres métricas.
        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime, List<string>? trainingTypes = null, string? rivalId = null, int? matchDurationMinutes = null)
        {
            var sportEvent = SportEvent.CreateNew(
                "PlayerStats Test Event",
                eveDateTime,
                eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, rivalId,
                trainingTypes: trainingTypes);
            sportEvent.MatchDurationMinutes = matchDurationMinutes;
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
        public async Task PlayerWithOldAndRecentActivity_SeasonTotalsIncludeAll_ReadinessOnlyUsesReplayWindow()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "old-and-recent-player");

            // Match 90 days ago (outside the 84-day replay window)
            var oldEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-90));
            var oldGoalsJson = $"[{{\"scorerId\":\"{teamPlayerId}\",\"isOwnTeam\":true}}]";
            await SeedMatchParticipationAsync(db, oldEventId, teamId, teamPlayerId, minutesPlayed: 90, goalsJson: oldGoalsJson);

            // Match 1 week ago (inside the replay window)
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
            Assert.Equal(1, stats.ReadinessBreakdown!.MatchesPlayed);
            Assert.Equal(60, stats.ReadinessBreakdown.MatchMinutesPlayed);
        }

        [Fact]
        public async Task PlayerWithFriendlyMatchMinutes_CountsTowardReadinessWithFriendlyTypeWeight()
        {
            // A friendly ("Amistoso") is real exertion and counts toward Rodaje, weighted 0.70
            // (MatchTypeWeighting): load = 1.5 x 65 / 70 x 0.70.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "friendly-player");

            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, minutesPlayed: 65);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            var step = Assert.Single(stats.ReadinessBreakdown!.Steps, s => s.Kind == DailyLoadModel.StepKindActivity);
            var matchEvent = Assert.Single(step.Events);
            Assert.Equal(friendlyEventId, matchEvent.EventId);
            Assert.Equal(0.70, matchEvent.TypeWeight, precision: 6);
            Assert.Equal(1.5 * 65 / 70d * 0.70, matchEvent.Load, precision: 6);
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

        [Fact]
        public async Task NewPlayerWithNoActivity_FatigueIsZero()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-default-player");

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(0, stats.Fatigue);
            Assert.NotNull(stats.FatigueBreakdown);
            Assert.Equal(0, stats.FatigueBreakdown.TrainingComponent);
            Assert.Equal(0, stats.FatigueBreakdown.MatchComponent);
        }

        [Fact]
        public async Task Fatigue_WithRecentTrainingAndMatch_BreakdownExposesComponentsAndDecayedRawValues()
        {
            // Same load as Fatigue_RecencyDecayReducesScoreEvenWithAFullWeekOfCommitment, but this
            // test asserts on FatigueBreakdown directly so the frontend can explain the number.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-breakdown-player");

            var training1 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-4));
            await SeedConvocationAsync(db, training1, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            var training2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedConvocationAsync(db, training2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1));
            await SeedMatchParticipationAsync(db, matchId, teamId, teamPlayerId, minutesPlayed: 70);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.NotNull(stats.FatigueBreakdown);
            // decay(4)=0.25, decay(2)=0.5 -> decayedTrainingCount=0.75 -> TrainingComponent=37.5
            Assert.Equal(0.75, stats.FatigueBreakdown.DecayedTrainingCount, precision: 3);
            Assert.Equal(37.5, stats.FatigueBreakdown.TrainingComponent, precision: 3);
            // decay(1)=0.70711 * 70 = 49.4975 -> MatchComponent = 49.4975/70*100 = 70.7107
            Assert.Equal(49.4975, stats.FatigueBreakdown.DecayedMatchMinutes, precision: 1);
            Assert.Equal(70.7107, stats.FatigueBreakdown.MatchComponent, precision: 1);
        }

        [Fact]
        public async Task Fatigue_EventsOutsideThe14DayLoadWindowDoNotCount()
        {
            // Regression for the flat-window bug's data-loading side: a training attended
            // outside the 14-day fatigue load window must not contribute at all, even though
            // it's well within the 8-week Rodaje window used elsewhere by the same handler.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-window-player");

            // Outside the 14-day fatigue load window (but inside the 8-week Rodaje window).
            var oldTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-20));
            await SeedConvocationAsync(db, oldTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Inside the load window, 2 days ago -> decay = 0.5 -> TrainingComponent = 25.
            var recentTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedConvocationAsync(db, recentTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // Only the -2 day training counts: TrainingComponent = 25 -> Fatigue = round(0.40 * 25) = 10.
            Assert.Equal(10, stats.Fatigue);
        }

        [Fact]
        public async Task Fatigue_RecencyDecayReducesScoreEvenWithAFullWeekOfCommitment()
        {
            // Regression for the real production bug ("Lucas"): a player with a full week of
            // commitment (2 trainings + a full match), all within the load window, no longer
            // pins Fatigue at 100 regardless of how many days ago each event happened.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-full-load-player");

            var training1 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-4));
            await SeedConvocationAsync(db, training1, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            var training2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedConvocationAsync(db, training2, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1));
            await SeedMatchParticipationAsync(db, matchId, teamId, teamPlayerId, minutesPlayed: 70);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // decay(4)=0.25, decay(2)=0.5 -> decayedTrainingCount=0.75 -> TrainingComponent=37.5
            // decay(1)=0.7071 * 70 = 49.497 -> MatchComponent = 49.497/70*100 = 70.71
            // Fatigue = round(0.40*37.5 + 0.60*70.71) = round(15 + 42.43) = 57
            Assert.Equal(57, stats.Fatigue);
            Assert.NotEqual(100, stats.Fatigue);
        }

        [Fact]
        public async Task Fatigue_RealProductionCase_LucasRecoversFromPinnedOneHundredPercent()
        {
            // The exact case that exposed the bug: trained Thursday (6 days ago), played a 90'
            // match Sunday (3 days ago), trained again Tuesday (1 day ago), evaluated today.
            // Two rest days followed the match and one followed the last training, so Fatigue
            // should read as partially recovered (~44%), not pinned at 100%.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-lucas-player");

            var thursdayTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-6));
            await SeedConvocationAsync(db, thursdayTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var sundayMatchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedMatchParticipationAsync(db, sundayMatchId, teamId, teamPlayerId, minutesPlayed: 90);

            var tuesdayTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1));
            await SeedConvocationAsync(db, tuesdayTrainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(44, stats.Fatigue);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(2, stats.Friendlies.Attended);
            Assert.Equal(2, stats.Friendlies.Possible);
        }

        [Fact]
        public async Task MinutesTarget_F11Team_WithoutSavedDuration_UsesCategoryDuration()
        {
            // Arrange: Juveniles (45' por parte → 90'). Ningún partido tiene duración guardada.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.Youth.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-target-player");

            var matchEventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10));
            await SeedMatchParticipationAsync(db, matchEventId, teamId, teamPlayerId, minutesPlayed: 45);

            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, minutesPlayed: 20);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert: 90' + 90' = 180'; 65' jugados → 36,1%.
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(65, stats.MinutesPlayed);
            Assert.Equal(36.1, stats.MinutesPlayedPercentOfSeasonTotal);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(0, stats.Friendlies.Attended);
            Assert.Equal(2, stats.Friendlies.Possible);
            Assert.Equal(2, stats.Friendlies.CalledButAbsent);
        }

        [Fact]
        public async Task MinutesTarget_SavedDurationIsUsed_ZeroFallsBackToCategory_AndPlayerMinutesAreCapped()
        {
            // Alevines (30' por parte → 60'). Partido con 35' guardados en el que el jugador tiene
            // 40' apuntados (le cuentan 35'), y otro con duración 0 (cae a 60') en el que juega 25'.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U10.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "saved-duration-player");

            var savedDurationId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-6), matchDurationMinutes: 35);
            await SeedMatchParticipationAsync(db, savedDurationId, teamId, teamPlayerId, minutesPlayed: 40);
            var zeroDurationId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-3), matchDurationMinutes: 0);
            await SeedMatchParticipationAsync(db, zeroDurationId, teamId, teamPlayerId, minutesPlayed: 25);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            // Total 35' + 60' = 95'; en el objetivo cuentan 35' + 25' = 60' → 63,2%.
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(65, stats.MinutesPlayed);
            Assert.Equal(63.2, stats.MinutesPlayedPercentOfSeasonTotal);
        }

        [Fact]
        public async Task MinutesTarget_RealCase_RotationBelowCategoryDurationDoesNotShrinkTheTotal()
        {
            // Cadete (80'): dos partidos sin duración guardada en los que nadie pasó de 70'. El
            // jugador juega 50' en uno. Antes el total salía 150' (33%); ahora 160' (31%).
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var fillerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "real-case-filler");
            var playerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "real-case-player");

            var playedId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-10));
            await SeedMatchParticipationAsync(db, playedId, teamId, fillerId, minutesPlayed: 70);
            await SeedMatchParticipationAsync(db, playedId, teamId, playerId, minutesPlayed: 50);
            var otherId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedMatchParticipationAsync(db, otherId, teamId, fillerId, minutesPlayed: 70);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == playerId);
            Assert.Equal(31.2, stats.MinutesPlayedPercentOfSeasonTotal); // 31,25 con redondeo bancario (en pantalla, 31%)
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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
        public async Task FormStatus_PlayerWithNoActivity_IsNull()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-no-activity");

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Null(stats.FormStatus);
            Assert.Null(stats.FormStatusBreakdown);
            Assert.Null(stats.Readiness);
            Assert.Null(stats.ReadinessBreakdown);
        }

        [Fact]
        public async Task FormStatus_MoreFriendlyMinutesNeverGiveLessFormStatus_RealCase()
        {
            // Caso real reportado: mismos entrenos y 2 amistosos Cadete; antes 108' daba menos EF
            // que 106' porque cada partido pesaba según su antigüedad.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var minutesByPlayer = new[] { (70, 36), (53, 55), (90, 18), (40, 70) };
            var playerIds = new List<string>();
            foreach (var (first, _) in minutesByPlayer)
                playerIds.Add(await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, $"form-status-minutes-{first}"));

            foreach (var days in new[] { 20, 18, 13, 11, 6, 4 })
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                foreach (var playerId in playerIds)
                    await SeedConvocationAsync(db, trainingId, playerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }
            var olderFriendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-15));
            var recentFriendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-1));
            for (var i = 0; i < playerIds.Count; i++)
            {
                await SeedMatchParticipationAsync(db, olderFriendlyId, teamId, playerIds[i], minutesPlayed: minutesByPlayer[i].Item1);
                await SeedMatchParticipationAsync(db, recentFriendlyId, teamId, playerIds[i], minutesPlayed: minutesByPlayer[i].Item2);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var byTotal = playerIds
                .Select((id, i) => (Total: minutesByPlayer[i].Item1 + minutesByPlayer[i].Item2, Stats: Assert.Single(result, p => p.TeamPlayerId == id)))
                .OrderBy(x => x.Total)
                .ToList();
            for (var i = 1; i < byTotal.Count; i++)
                Assert.True(byTotal[i].Stats.FormStatusBreakdown!.Value >= byTotal[i - 1].Stats.FormStatusBreakdown!.Value,
                    $"{byTotal[i].Total}' debería tener EF >= que {byTotal[i - 1].Total}'");
        }

        [Fact]
        public async Task FormStatus_CategoryWithoutStandardDuration_IsNullEvenWithActivity()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db); // NationalCategory: sin duracion estandar
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-no-standard-category");
            var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Null(stats.FormStatus);
            Assert.Null(stats.FormStatusBreakdown);
            Assert.NotNull(stats.Readiness);
        }

        [Fact]
        public async Task FormStatus_DoesNotApplyFatigue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-fatigue");
            foreach (var days in new[] { 1, 2, 3 })
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.True(stats.Fatigue > 0);
            // 3 entrenos Físicos: 100 x (1 - e^(-0.16 x 3)) = 38.1, sin factor de Cansancio.
            Assert.Equal(38, stats.FormStatus);
        }

        [Fact]
        public async Task FormStatus_ActivityInsideTheEightyFourDayReplayCounts_OlderDoesNot()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var insideId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-inside-replay");
            var outsideId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-outside-replay");

            var insideTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-70), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, insideTrainingId, insideId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            var outsideTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-90), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, outsideTrainingId, outsideId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var inside = Assert.Single(result, p => p.TeamPlayerId == insideId);
            Assert.Equal(0, inside.FormStatus);
            Assert.Equal(DailyLoadModel.ReplayDays, inside.FormStatusBreakdown!.ReplayDays);
            Assert.Contains(inside.FormStatusBreakdown.Steps, s => s.Events.Any(e => e.EventId == insideTrainingId));
            // Del día siguiente al entreno hasta ayer: hoy, sin actividad todavía, no cuenta.
            Assert.Equal(69, inside.FormStatusBreakdown.CurrentRestStreakDays);

            var outside = Assert.Single(result, p => p.TeamPlayerId == outsideId);
            Assert.Null(outside.FormStatus);
        }

        [Fact]
        public async Task FormStatus_MissedEventsExposeMatchAndTrainingReasons()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var starterId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-starter", DateTime.UtcNow.AddDays(-60));
            var absentId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-absent", DateTime.UtcNow.AddDays(-60));
            var benchId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-bench", DateTime.UtcNow.AddDays(-60));
            var notConvokedId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-not-convoked", DateTime.UtcNow.AddDays(-60));

            var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedMatchParticipationAsync(db, matchId, teamId, starterId, minutesPlayed: 70);
            await SeedConvocationAsync(db, matchId, absentId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);
            await SeedConvocationAsync(db, matchId, benchId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-3), new List<string> { "Fisico" });
            foreach (var playerId in new[] { absentId, benchId, notConvokedId })
                await SeedConvocationAsync(db, trainingId, playerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            var missedTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-2), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, missedTrainingId, absentId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var absent = Assert.Single(result, p => p.TeamPlayerId == absentId).FormStatusBreakdown!;
            Assert.Contains(absent.MissedEvents, m => m.EventId == matchId && m.Reason == AssistanceType.UnexcusedAbsence.Name);
            Assert.Contains(absent.MissedEvents, m => m.EventId == missedTrainingId && m.Reason == AssistanceType.UnexcusedAbsence.Name);
            Assert.Equal(1, absent.TrainingsAttended);

            var bench = Assert.Single(result, p => p.TeamPlayerId == benchId).FormStatusBreakdown!;
            Assert.Contains(bench.MissedEvents, m => m.EventId == matchId && m.Reason == "Convocado sin jugar");

            var notConvoked = Assert.Single(result, p => p.TeamPlayerId == notConvokedId).FormStatusBreakdown!;
            Assert.Contains(notConvoked.MissedEvents, m => m.EventId == matchId && m.Reason == "No convocado");

            var starter = Assert.Single(result, p => p.TeamPlayerId == starterId);
            Assert.Equal(1, starter.FormStatusBreakdown!.MatchesPlayed);
            Assert.Equal(70, starter.FormStatusBreakdown.MatchMinutesPlayed);
        }

        [Fact]
        public async Task Fatigue_FisicoTraining_WeighsMoreThanTecnicoTraining_SameDaysAgo()
        {
            // Regression/end-to-end for training-type weighting reaching Cansancio via the
            // handler's real EF projections (se.TrainingTypes), not just the pure calculator.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var fisicoPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-fisico-player");
            var tecnicoPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "fatigue-tecnico-player");

            var fisicoTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, fisicoTrainingId, fisicoPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var tecnicoTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Tecnico" });
            await SeedConvocationAsync(db, tecnicoTrainingId, tecnicoPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var fisicoStats = Assert.Single(result, p => p.TeamPlayerId == fisicoPlayerId);
            var tecnicoStats = Assert.Single(result, p => p.TeamPlayerId == tecnicoPlayerId);
            Assert.True(fisicoStats.Fatigue > tecnicoStats.Fatigue);
        }

        [Fact]
        public async Task Readiness_TacticoTraining_ContributesMoreThanTecnicoTraining_SameAttendance()
        {
            // End-to-end for training-type weighting reaching Rodaje via the handler's real EF
            // projections (se.TrainingTypes).
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var tacticoPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "readiness-tactico-player");
            var tecnicoPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "readiness-tecnico-player");

            var tacticoTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Tactico" });
            await SeedConvocationAsync(db, tacticoTrainingId, tacticoPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var tecnicoTrainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Tecnico" });
            await SeedConvocationAsync(db, tecnicoTrainingId, tecnicoPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var tacticoStats = Assert.Single(result, p => p.TeamPlayerId == tacticoPlayerId);
            var tecnicoStats = Assert.Single(result, p => p.TeamPlayerId == tecnicoPlayerId);
            Assert.NotNull(tacticoStats.Readiness);
            Assert.NotNull(tecnicoStats.Readiness);
            Assert.True(tacticoStats.Readiness > tecnicoStats.Readiness);
        }

        [Fact]
        public async Task Breakdowns_ExposeParametersAndPerEventLoads_ForFatigueReadinessAndFormStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "breakdowns-player");

            var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var friendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedMatchParticipationAsync(db, friendlyId, teamId, teamPlayerId, minutesPlayed: 70);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);

            // Cansancio: training weighted 1.00 (Fisico), match weighted 0.70 (Amistoso).
            var fatigueTraining = Assert.Single(stats.FatigueBreakdown.ConsideredTrainings);
            Assert.Equal(trainingId, fatigueTraining.EventId);
            Assert.Equal(1.00, fatigueTraining.TypeWeight, precision: 3);
            var fatigueMatch = Assert.Single(stats.FatigueBreakdown.ConsideredMatches);
            Assert.Equal(0.70, fatigueMatch.TypeWeight, precision: 3);

            // Rodaje: Fisico weighs 0.30, the friendly 0.70 over 70 reference minutes.
            var readiness = stats.ReadinessBreakdown!;
            Assert.Equal(PlayerReadinessCalculator.Parameters.GainRate, readiness.GainRate);
            Assert.Equal(21, readiness.GraceRestDays);
            Assert.Equal(70d, readiness.ReferenceMatchMinutes);
            var readinessTraining = readiness.Steps.SelectMany(s => s.Events).Single(e => e.EventId == trainingId);
            Assert.Equal(0.30, readinessTraining.Load, precision: 6);
            var readinessMatch = readiness.Steps.SelectMany(s => s.Events).Single(e => e.EventId == friendlyId);
            Assert.Equal(1.5 * 0.70, readinessMatch.Load, precision: 6);

            // Estado de forma: Fisico weighs 1.00; the match load ignores match type (Cadete: 70 minutos completos).
            var form = stats.FormStatusBreakdown!;
            Assert.Equal(PlayerFormStatusCalculator.Parameters.GainRate, form.GainRate);
            Assert.Equal(4, form.GraceRestDays);
            Assert.Equal(0.5, form.DecayStepPerDay);
            Assert.Equal(3, form.DecayMaxPerDay);
            Assert.Equal(1.5, form.MatchLoadPerReferenceMatch);
            Assert.Equal(70d, form.ReferenceMatchMinutes, precision: 6);
            Assert.Equal(1, form.TrainingsAttended);
            Assert.Equal(1, form.MatchesPlayed);
            var formTraining = form.Steps.SelectMany(s => s.Events).Single(e => e.EventId == trainingId);
            Assert.Equal(1.00, formTraining.Load, precision: 6);
            Assert.Equal(new[] { "Fisico" }, formTraining.TrainingTypes);
            var formMatch = form.Steps.SelectMany(s => s.Events).Single(e => e.EventId == friendlyId);
            Assert.Equal(70, formMatch.MinutesPlayed);
            Assert.Equal(1.5, formMatch.Load, precision: 6);
            Assert.Equal(DailyLoadModel.StepKindActivity, form.Steps.First().Kind);
            Assert.Equal(form.Value, form.Steps.First().ValueAfter, precision: 9);
        }

        [Fact]
        public async Task MinutesTarget_VerdictSeparatesPlayerAbsencesFromCoachDecisions()
        {
            // Cadete (80'): 5 partidos de 80' = 400' totales; un compañero juega los 80' de todos.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var fillerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-verdict-filler");
            var metId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-verdict-met");
            var ownAbsencesId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-verdict-own-absences");
            var coachId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-verdict-coach");
            var neverWentId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "minutes-verdict-never-went");

            var matchIds = new List<string>();
            foreach (var days in new[] { 40, 30, 20, 10, 5 })
            {
                var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-days));
                await SeedMatchParticipationAsync(db, matchId, teamId, fillerId, minutesPlayed: 80);
                matchIds.Add(matchId);
            }
            var deconvoke = ConvocationStatus.FromName("Deconvoke").Id;
            var justified = ConvocationStatus.FromName("Justified").Id;

            // 130' sin ausencias.
            await SeedMatchParticipationAsync(db, matchIds[0], teamId, metId, minutesPlayed: 80);
            await SeedMatchParticipationAsync(db, matchIds[1], teamId, metId, minutesPlayed: 50);

            // 100' y 2 partidos desconvocado por lesión: disponibles 240'.
            await SeedMatchParticipationAsync(db, matchIds[0], teamId, ownAbsencesId, minutesPlayed: 50);
            await SeedMatchParticipationAsync(db, matchIds[1], teamId, ownAbsencesId, minutesPlayed: 50);
            await SeedConvocationAsync(db, matchIds[2], ownAbsencesId, deconvoke, excuseTypeId: ExcuseTypes.FromId(1)!.Id);
            await SeedConvocationAsync(db, matchIds[3], ownAbsencesId, deconvoke, excuseTypeId: ExcuseTypes.FromId(1)!.Id);

            // 60', 1 ausencia sin excusa; la decisión técnica y el convocado presente sin minutos no restan.
            await SeedMatchParticipationAsync(db, matchIds[0], teamId, coachId, minutesPlayed: 60);
            await SeedConvocationAsync(db, matchIds[1], coachId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);
            await SeedConvocationAsync(db, matchIds[2], coachId, deconvoke, excuseTypeId: ExcuseTypes.TechnicalDecision.Id);
            await SeedConvocationAsync(db, matchIds[3], coachId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            // Ausente de todos los partidos.
            foreach (var matchId in matchIds.Take(4))
                await SeedConvocationAsync(db, matchId, neverWentId, deconvoke, excuseTypeId: ExcuseTypes.FromId(3)!.Id);
            await SeedConvocationAsync(db, matchIds[4], neverWentId, justified);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var met = Assert.Single(result, p => p.TeamPlayerId == metId);
            Assert.Equal("Met", met.MinutesTargetStatus);
            Assert.Equal(32.5, met.MinutesPlayedPercentOfAvailable);

            var ownAbsences = Assert.Single(result, p => p.TeamPlayerId == ownAbsencesId);
            Assert.Equal(25.0, ownAbsences.MinutesPlayedPercentOfSeasonTotal);
            Assert.Equal(41.7, ownAbsences.MinutesPlayedPercentOfAvailable);
            Assert.Equal("NotMetByOwnAbsences", ownAbsences.MinutesTargetStatus);

            var coach = Assert.Single(result, p => p.TeamPlayerId == coachId);
            Assert.Equal(18.8, coach.MinutesPlayedPercentOfAvailable);
            Assert.Equal("NotMet", coach.MinutesTargetStatus);

            var neverWent = Assert.Single(result, p => p.TeamPlayerId == neverWentId);
            Assert.Null(neverWent.MinutesPlayedPercentOfAvailable);
            Assert.Equal("NotMetByOwnAbsences", neverWent.MinutesTargetStatus);
            Assert.Equal(neverWent.MatchesAbsentAttributableToPlayer, neverWent.AttributableAbsences.Length);
        }

        [Fact]
        public async Task MinutesTarget_AttributableAbsencesListKindReasonOpponentAndOrder()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var fillerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "absences-list-filler");
            var playerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "absences-list-player");
            var rival = new Rival($"CD Rival {Guid.NewGuid():N}", null, null);
            db.Rivals.Add(rival);
            await db.SaveChangesAsync();

            var olderId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-20), rivalId: rival.Id);
            var newerId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedMatchParticipationAsync(db, olderId, teamId, fillerId, minutesPlayed: 80);
            await SeedMatchParticipationAsync(db, newerId, teamId, fillerId, minutesPlayed: 70);
            await SeedConvocationAsync(db, olderId, playerId, ConvocationStatus.FromName("Deconvoke").Id, excuseTypeId: ExcuseTypes.FromId(3)!.Id);
            await SeedConvocationAsync(db, newerId, playerId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == playerId);
            Assert.Equal(2, stats.MatchesAbsentAttributableToPlayer);
            Assert.Collection(stats.AttributableAbsences,
                a =>
                {
                    Assert.Equal(newerId, a.EventId);
                    Assert.Equal(FriendlyEventTypeId, a.EventTypeId);
                    Assert.Equal("PlayerStats Test Event", a.Opponent);
                    Assert.Equal(80, a.MatchMinutes); // sin duración guardada: la de la categoría
                    Assert.Equal("NoShow", a.Kind);
                    Assert.Null(a.Reason);
                },
                a =>
                {
                    Assert.Equal(olderId, a.EventId);
                    Assert.Equal(rival.Name, a.Opponent);
                    Assert.Equal(80, a.MatchMinutes);
                    Assert.Equal("Declined", a.Kind);
                    Assert.Equal("Enfermedad", a.Reason);
                });
        }

        [Fact]
        public async Task MinutesTarget_NonF11Team_VerdictIsNullButAbsencesAreListed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db); // NationalCategory: sin objetivo
            var fillerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "non-f11-filler");
            var playerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "non-f11-player");
            var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-3));
            await SeedMatchParticipationAsync(db, matchId, teamId, fillerId, minutesPlayed: 90);
            await SeedConvocationAsync(db, matchId, playerId, convocationStatusId: null, assistanceTypeId: AssistanceType.ExcusedAbsence.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == playerId);
            Assert.Null(stats.MinutesTargetStatus);
            Assert.Null(stats.MinutesPlayedPercentOfAvailable);
            var absence = Assert.Single(stats.AttributableAbsences);
            Assert.Equal("NoShow", absence.Kind);
            Assert.Equal(0, absence.MatchMinutes);
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
