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
        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime, List<string>? trainingTypes = null)
        {
            var sportEvent = SportEvent.CreateNew(
                "PlayerStats Test Event",
                eveDateTime,
                eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, null,
                trainingTypes: trainingTypes);
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
        public async Task PlayerWithFriendlyMatchMinutes_CountsTowardReadinessMatchComponent()
        {
            // Regression: a friendly ("Amistoso") is real physical exertion and must count
            // toward Rodaje's match component, even though it's excluded elsewhere (season
            // discipline counters) as an official match. Before the fix, the windowed match
            // query only looked at EventTypeId == Partido, silently dropping friendly minutes.
            // MatchMinutesInWindow is now a weighted sum (MatchTypeWeighting, Decisión 2): a
            // friendly counts at 70% of its real minutes, not 1:1 like a league match — 65 * 0.70
            // = 45.5 -> truncated to 45 by the (int) cast in PlayerReadinessCalculator.Calculate.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "friendly-player");

            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, minutesPlayed: 65);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.NotNull(stats.ReadinessBreakdown);
            Assert.Equal(45, stats.ReadinessBreakdown!.MatchMinutesInWindow);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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

            var handler = new GetTeamPlayerStatistics.Handler(db);
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
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-no-activity");

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Null(stats.FormStatus);
            Assert.Null(stats.FormStatusBreakdown);
        }

        [Fact]
        public async Task FormStatus_TrainsButNeverPlaysAndIsAbsentFromFriendlies_CannotExceedFiftyFive()
        {
            // Caso real "Zuri": 5 de 7 entrenos, 0 minutos, y 2 amistosos en los que fue convocado
            // y luego deconvocado por un motivo que no es decision tecnica (falta imputable). Antes
            // del cambio esos amistosos se excluian, el bloque de partidos quedaba vacio y se
            // renormalizaba a los entrenos, dando ~92%.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var zuriId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-zuri", DateTime.UtcNow.AddDays(-60));

            var attendedDays = new[] { 20, 23, 26, 29, 32 };
            var missedDays = new[] { 21, 30 };
            foreach (var days in attendedDays)
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, zuriId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }
            foreach (var days in missedDays)
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, zuriId, convocationStatusId: ConvocationStatus.FromName("Deconvoke").Id);
            }
            // Un compañero juega esos amistosos: el partido existe para el equipo (tiene participacion
            // `finished`), y Zuri figura como convocado y luego deconvocado.
            var teammateId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-zuri-teammate", DateTime.UtcNow.AddDays(-60));
            foreach (var days in new[] { 22, 31 })
            {
                var friendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-days));
                await SeedMatchParticipationAsync(db, friendlyId, teamId, teammateId, minutesPlayed: 70);
                await SeedConvocationAsync(db, friendlyId, zuriId, convocationStatusId: ConvocationStatus.FromName("Deconvoke").Id);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == zuriId);
            Assert.NotNull(stats.FormStatus);
            Assert.True(stats.FormStatus <= 55, $"Estado de forma esperado <= 55 y fue {stats.FormStatus}");
            var breakdown = stats.FormStatusBreakdown!;
            Assert.Equal(0, breakdown.MatchComponent);
            Assert.Equal(0.45, breakdown.MatchWeightApplied, precision: 6);
            Assert.All(breakdown.ConsideredMatches, m => Assert.Equal("Absent", m.Status));
            Assert.Equal(2, breakdown.MatchesConsidered);
            Assert.Equal(7, breakdown.TrainingSessionsOffered);
            Assert.Equal(5, breakdown.TrainingSessionsAttended);
        }

        [Fact]
        public async Task FormStatus_CadeteHealthyPlayerWithNoRecentFatigue_IsOneHundred_AndBreakdownExposesCategoryMinutes()
        {
            // Eventos entre 20 y 40 dias atras: dentro de la ventana de forma (42) pero fuera de la
            // de Cansancio (14), asi que Fatigue = 0 y asistir a todo + jugar completo da 100.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-high-player", DateTime.UtcNow.AddDays(-60));

            // Volumen de referencia de entrenos (Decision 12): 12 sesiones asistidas; 2 partidos de 70' bastan.
            foreach (var days in new[] { 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41 })
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }

            foreach (var days in new[] { 18, 22 })
            {
                var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-days));
                await SeedMatchParticipationAsync(db, matchId, teamId, teamPlayerId, minutesPlayed: 70);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.Equal(0, stats.Fatigue);
            Assert.Equal(100, stats.FormStatus);
            var breakdown = stats.FormStatusBreakdown!;
            Assert.Equal(70.0, breakdown.FullMatchMinutes, precision: 6);
            Assert.Equal(80, breakdown.CategoryMatchMinutes);
            Assert.Equal(0.875, breakdown.FullStimulusFraction, precision: 6);
            Assert.Equal(42, breakdown.WindowDays);
            Assert.Equal(7, breakdown.RecencyFullWeightDays);
            Assert.Equal(14, breakdown.RecencyHalfLifeDays);
            Assert.Equal(12, breakdown.TrainingSessionsOffered);
            Assert.Equal(12, breakdown.TrainingSessionsAttended);
            Assert.Equal(2, breakdown.MatchesConsidered);
            Assert.Equal(12, breakdown.ReferenceTrainingSessions);
            Assert.Equal(1.0, breakdown.TrainingVolumeFactor!.Value, precision: 6);
            Assert.Equal(140, breakdown.MatchMinutesPlayedTotal);
            Assert.Equal(160, breakdown.MatchMinutesPossibleTotal);
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
        public async Task FormStatus_BreakdownFatigueMatchesPlayerFatigue_AndScoreAppliesTheFactor()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-fatigue", DateTime.UtcNow.AddDays(-60));
            foreach (var days in new[] { 1, 2, 3 })
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            Assert.True(stats.Fatigue > 0);
            var breakdown = stats.FormStatusBreakdown!;
            Assert.Equal(stats.Fatigue, breakdown.Fatigue);
            Assert.Equal(1d - stats.Fatigue / 200d, breakdown.FatigueFactor, precision: 6);
            // 3 sesiones asistidas de 12 de referencia: ratio 100 x volumen 0.25 = 25.
            Assert.Equal(100, breakdown.TrainingRatioComponent!.Value, precision: 6);
            Assert.Equal(0.25, breakdown.TrainingVolumeFactor!.Value, precision: 6);
            Assert.Equal(25, breakdown.BaseScore, precision: 6);
            Assert.Equal((int)Math.Round(25 * breakdown.FatigueFactor, MidpointRounding.AwayFromZero), stats.FormStatus);
        }

        [Fact]
        public async Task FormStatus_OnlyTecnicoTrainingsAttended_UsesWeightFallback_AndVolumeFactorScalesThreeSessions()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-tecnico", DateTime.UtcNow.AddDays(-60));
            foreach (var days in new[] { 20, 25, 30 })
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-days), new List<string> { "Tecnico" });
                await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);
            // Ratio 100 (fallback w = 1) x volumen 3/12 = 25.
            Assert.Equal(25, stats.FormStatus);
            Assert.True(stats.FormStatusBreakdown!.TrainingTypeWeightFallbackUsed);
        }

        [Fact]
        public async Task FormStatus_PlayerAbsentFromTeamMatch_CountsRatioZero_AndNotConvokedMatchIsExcluded()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var starterId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-starter", DateTime.UtcNow.AddDays(-60));
            var absentId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-absent", DateTime.UtcNow.AddDays(-60));
            var notConvokedId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-not-convoked", DateTime.UtcNow.AddDays(-60));

            var matchId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-20));
            await SeedMatchParticipationAsync(db, matchId, teamId, starterId, minutesPlayed: 70);
            await SeedConvocationAsync(db, matchId, absentId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            // Un entreno para que el jugador no convocado a partido tenga desglose.
            var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-20), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, trainingId, notConvokedId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var absent = Assert.Single(result, p => p.TeamPlayerId == absentId);
            var absentMatch = Assert.Single(absent.FormStatusBreakdown!.ConsideredMatches);
            Assert.Equal(matchId, absentMatch.EventId);
            Assert.Equal(0, absentMatch.Ratio);
            Assert.Equal(0, absent.FormStatus);
            Assert.Equal("Absent", absentMatch.Status);

            var notConvoked = Assert.Single(result, p => p.TeamPlayerId == notConvokedId);
            Assert.Equal(1, notConvoked.FormStatusBreakdown!.ExcludedMatches);
            Assert.Empty(notConvoked.FormStatusBreakdown.ConsideredMatches);
            // El equipo si jugo un partido en la ventana: no se renormaliza, el componente es 0.
            Assert.Equal(0d, notConvoked.FormStatusBreakdown.MatchComponent);
            Assert.Equal(0.55, notConvoked.FormStatusBreakdown.TrainingWeightApplied, precision: 6);
            Assert.Equal(0.45, notConvoked.FormStatusBreakdown.MatchWeightApplied, precision: 6);
        }

        [Fact]
        public async Task FormStatus_TrainsButDeconvokedFromFriendliesWithoutPlaying_IsCappedAtFiftyFive_AndFriendliesAreAbsent()
        {
            // Caso Zuri: 5/7 entrenos, 2 amistosos deconvocado sin asistencia, 0 minutos.
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var zuriId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-zuri", DateTime.UtcNow.AddDays(-60));

            var deconvokeId = ConvocationStatus.FromName("Deconvoke").Id;
            var friendlyIds = new List<string>();
            foreach (var days in new[] { 20, 27 })
            {
                var friendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-days));
                friendlyIds.Add(friendlyId);
                await SeedConvocationAsync(db, friendlyId, zuriId, convocationStatusId: deconvokeId, assistanceTypeId: null);
                await SeedMatchParticipationAsync(db, friendlyId, teamId, teamPlayerId: await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, $"form-status-zuri-mate-{days}", DateTime.UtcNow.AddDays(-60)), minutesPlayed: 70);
            }

            var trainingDays = new[] { 18, 21, 25, 28, 32, 35, 38 };
            for (var i = 0; i < trainingDays.Length; i++)
            {
                var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-trainingDays[i]), new List<string> { "Fisico" });
                await SeedConvocationAsync(db, trainingId, zuriId, convocationStatusId: null,
                    assistanceTypeId: i < 5 ? AssistanceType.Attendance.Id : AssistanceType.UnexcusedAbsence.Id);
            }

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var stats = Assert.Single(result, p => p.TeamPlayerId == zuriId);
            Assert.InRange(stats.FormStatus!.Value, 0, 55);
            var breakdown = stats.FormStatusBreakdown!;
            Assert.Equal(0d, breakdown.MatchComponent);
            Assert.Equal(0.45, breakdown.MatchWeightApplied, precision: 6);
            Assert.Equal(2, breakdown.ConsideredMatches.Length);
            Assert.All(breakdown.ConsideredMatches, m => Assert.Equal("Absent", m.Status));
        }

        [Fact]
        public async Task FormStatus_TrainingAbsence_ExposesReasonAndCountsZero()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "form-status-training-absence", DateTime.UtcNow.AddDays(-60));
            var attendedId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-20), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, attendedId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);
            var missedId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-21), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, missedId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.UnexcusedAbsence.Id);

            var result = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var breakdown = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId).FormStatusBreakdown!;
            Assert.Equal(2, breakdown.TrainingSessionsOffered);
            Assert.Equal(1, breakdown.TrainingSessionsAttended);
            var missed = Assert.Single(breakdown.ConsideredTrainings, t => !t.Attended);
            Assert.Equal(missedId, missed.EventId);
            Assert.False(string.IsNullOrWhiteSpace(missed.AbsenceReason));
            Assert.Equal(0, missed.ReceivedLoad);
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
        public async Task ConsideredLists_ExposeEventIdDateWeightAndContribution_ForFatigueReadinessAndFormStatus()
        {
            // End-to-end transparency test: the coach cannot understand an aggregate percentage
            // like "Entreno 19%" — this asserts the handler actually surfaces the per-event
            // breakdown (weights + contributions) the frontend needs to render a readable table,
            // for all three metrics at once, from real EF-seeded events (not the pure calculator).
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId: Category.U14.Id);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "considered-lists-player");

            var trainingId = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, trainingId, teamPlayerId, convocationStatusId: null, assistanceTypeId: AssistanceType.Attendance.Id);

            var friendlyId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedMatchParticipationAsync(db, friendlyId, teamId, teamPlayerId, minutesPlayed: 70);

            var handler = new GetTeamPlayerStatistics.Handler(db);
            var query = new GetTeamPlayerStatistics.Query { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var stats = Assert.Single(result, p => p.TeamPlayerId == teamPlayerId);

            // Fatigue: training weighted 1.00 (Fisico), match weighted 0.70 (Amistoso).
            Assert.NotNull(stats.FatigueBreakdown);
            var fatigueTraining = Assert.Single(stats.FatigueBreakdown.ConsideredTrainings);
            Assert.Equal(trainingId, fatigueTraining.EventId);
            Assert.Equal(1, fatigueTraining.DaysAgo);
            Assert.Equal(1.00, fatigueTraining.TypeWeight, precision: 3);
            var fatigueMatch = Assert.Single(stats.FatigueBreakdown.ConsideredMatches);
            Assert.Equal(friendlyId, fatigueMatch.EventId);
            Assert.Equal(0.70, fatigueMatch.TypeWeight, precision: 3);
            Assert.Equal(PlayerFatigueCalculator.TrainingWeight, stats.FatigueBreakdown.TrainingWeight);
            Assert.Equal(PlayerFatigueCalculator.MatchWeight, stats.FatigueBreakdown.MatchWeight);

            // Readiness: Fisico contributes with weight 0.30 for Rodaje.
            Assert.NotNull(stats.ReadinessBreakdown);
            var readinessTraining = Assert.Single(stats.ReadinessBreakdown!.ConsideredTrainings);
            Assert.Equal(trainingId, readinessTraining.EventId);
            Assert.True(readinessTraining.CountsTowardScore);
            Assert.Equal(0.30, readinessTraining.TypeWeight, precision: 3);
            Assert.Equal(30, readinessTraining.Contribution, precision: 3);
            var readinessMatch = Assert.Single(stats.ReadinessBreakdown.ConsideredMatches);
            Assert.Equal(friendlyId, readinessMatch.EventId);
            Assert.Equal(0.70, readinessMatch.TypeWeight, precision: 3);
            Assert.Equal(49, readinessMatch.EffectiveMinutes, precision: 3);
            Assert.Equal(PlayerReadinessCalculator.TrainingWeight, stats.ReadinessBreakdown.TrainingWeight);
            Assert.Equal(PlayerReadinessCalculator.MatchWeight, stats.ReadinessBreakdown.MatchWeight);

            // Estado de forma: Fisico weighs 1.00; the match ratio is minutes / full-stimulus minutes
            // (Cadete: 70) regardless of match type.
            Assert.NotNull(stats.FormStatusBreakdown);
            var formStatusTraining = Assert.Single(stats.FormStatusBreakdown!.ConsideredTrainings);
            Assert.Equal(trainingId, formStatusTraining.EventId);
            Assert.True(formStatusTraining.Attended);
            Assert.Equal(1.00, formStatusTraining.TypeWeight, precision: 3);
            Assert.Equal(1.00, formStatusTraining.RecencyWeight, precision: 3);
            Assert.Equal(1.00, formStatusTraining.OfferedLoad, precision: 3);
            Assert.Equal(1.00, formStatusTraining.ReceivedLoad, precision: 3);
            var formStatusMatch = Assert.Single(stats.FormStatusBreakdown.ConsideredMatches);
            Assert.Equal(friendlyId, formStatusMatch.EventId);
            Assert.Equal(70, formStatusMatch.MinutesPlayed);
            Assert.Equal(70.0, formStatusMatch.FullMatchMinutes, precision: 3);
            Assert.Equal(1.0, formStatusMatch.Ratio, precision: 3);
            Assert.Equal("Played", formStatusMatch.Status);
            Assert.Equal(PlayerFormStatusCalculator.TrainingWeightNominal, stats.FormStatusBreakdown.TrainingWeightNominal);
            Assert.Equal(PlayerFormStatusCalculator.MatchWeightNominal, stats.FormStatusBreakdown.MatchWeightNominal);
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
