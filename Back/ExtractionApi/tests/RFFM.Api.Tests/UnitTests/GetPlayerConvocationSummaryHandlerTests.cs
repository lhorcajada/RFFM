#nullable enable
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
    /// <summary>
    /// Covers GetPlayerConvocationSummary: aggregate starts/convocations totals (overall and
    /// broken down by event type), the most recent match the coach deconvoked the player from
    /// (with reason), and the most recent match the player was accepted into but missed
    /// (AssistanceType Excused/UnexcusedAbsence, with reason when available).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetPlayerConvocationSummaryHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;
        private static readonly int AcceptedStatusId = ConvocationStatus.FromName("Accepted").Id;
        private static readonly int ExcusedAbsenceTypeId = AssistanceType.ExcusedAbsence.Id;
        private static readonly int UnexcusedAbsenceTypeId = AssistanceType.UnexcusedAbsence.Id;

        public GetPlayerConvocationSummaryHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"ConvocationSummary Test Club {Guid.NewGuid():N}", 1);
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
                Name = "ConvocationSummary Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(AppDbContext db, string teamId, string clubId, string seasonId, string alias)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = alias,
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

        private async Task<string> SeedRivalAsync(AppDbContext db, string name)
        {
            var rival = new Rival(name, null, null);
            db.Rivals.Add(rival);
            await db.SaveChangesAsync();
            return rival.Id;
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime, string? rivalId)
        {
            var sportEvent = SportEvent.CreateNew(
                "ConvocationSummary Test Event",
                eveDateTime, eveDateTime,
                null, null, null, null,
                eventTypeId, teamId, rivalId);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task<string> SeedConvocationAsync(
            AppDbContext db, string eventId, string teamPlayerId, int convocationStatusId,
            int? assistanceTypeId = null, int? excuseTypeId = null)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = assistanceTypeId,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = convocationStatusId,
                ExcuseTypeId = excuseTypeId
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();
            return convocation.Id;
        }

        private async Task SeedMatchParticipationAsync(
            AppDbContext db, string eventId, string teamId, string teamPlayerId, bool isStarter, int minutesPlayed)
        {
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: minutesPlayed, isStarter: isStarter,
                enteredAtMinute: isStarter ? 0 : (int?)46, exitedAtMinute: null,
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
        public async Task Handle_CountsStartsOnlyFromParticipationsWhereIsStarterTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "starts-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival Starts");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedMatchParticipationAsync(db, event1, teamId, teamPlayerId, isStarter: true, minutesPlayed: 90);

            var event2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5), rivalId);
            await SeedMatchParticipationAsync(db, event2, teamId, teamPlayerId, isStarter: false, minutesPlayed: 20);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Equal(1, result.TotalStarts);
        }

        [Fact]
        public async Task Handle_CountsAllConvocationsRegardlessOfStatusOrMinutesPlayed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "convocations-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival Convocations");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-30), rivalId);
            await SeedConvocationAsync(db, event1, teamPlayerId, AcceptedStatusId);

            var event2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-20), rivalId);
            await SeedConvocationAsync(db, event2, teamPlayerId, DeconvokeStatusId);

            var event3 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedConvocationAsync(db, event3, teamPlayerId, AcceptedStatusId, ExcusedAbsenceTypeId);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Equal(3, result.TotalConvocations);
        }

        [Fact]
        public async Task Handle_NoDeconvokedMatches_ReturnsNullLastDeconvokedMatch()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-deconvoke-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival None");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedConvocationAsync(db, event1, teamPlayerId, AcceptedStatusId);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Null(result.LastDeconvokedMatch);
        }

        [Fact]
        public async Task Handle_TwoDeconvokedMatches_ReturnsMostRecentWithRivalAndEventType()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "deconvoke-player");
            var rivalIdOld = await SeedRivalAsync(db, "CD Rival Old");
            var rivalIdNew = await SeedRivalAsync(db, "CD Rival New");

            var olderDate = DateTime.UtcNow.AddDays(-20).Date;
            var newerDate = DateTime.UtcNow.AddDays(-3).Date;

            var olderEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, olderDate, rivalIdOld);
            await SeedConvocationAsync(db, olderEvent, teamPlayerId, DeconvokeStatusId, excuseTypeId: ExcuseTypes.SportiveSanction.Id);

            var newerEvent = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, newerDate, rivalIdNew);
            await SeedConvocationAsync(db, newerEvent, teamPlayerId, DeconvokeStatusId, excuseTypeId: 1);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.NotNull(result.LastDeconvokedMatch);
            Assert.Equal(newerEvent, result.LastDeconvokedMatch!.EventId);
            Assert.Equal(newerDate, result.LastDeconvokedMatch.MatchDate);
            Assert.Equal("CD Rival New", result.LastDeconvokedMatch.RivalName);
            Assert.Equal(FriendlyEventTypeId, result.LastDeconvokedMatch.EventTypeId);
            Assert.Equal("Amistoso", result.LastDeconvokedMatch.EventTypeName);
            Assert.Equal("Lesión", result.LastDeconvokedMatch.Reason);
        }

        [Fact]
        public async Task Handle_NoAbsences_ReturnsNullLastAbsenceMatch()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-absence-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival None2");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedConvocationAsync(db, event1, teamPlayerId, DeconvokeStatusId);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Null(result.LastAbsenceMatch);
        }

        [Fact]
        public async Task Handle_TwoExcusedAbsences_ReturnsMostRecentWithRivalEventTypeAndReason()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "absence-player");
            var rivalIdOld = await SeedRivalAsync(db, "CD Rival Absence Old");
            var rivalIdNew = await SeedRivalAsync(db, "CD Rival Absence New");

            var olderDate = DateTime.UtcNow.AddDays(-15).Date;
            var newerDate = DateTime.UtcNow.AddDays(-2).Date;

            var olderEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, olderDate, rivalIdOld);
            await SeedConvocationAsync(db, olderEvent, teamPlayerId, AcceptedStatusId, ExcusedAbsenceTypeId, excuseTypeId: 3);

            var newerEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, newerDate, rivalIdNew);
            await SeedConvocationAsync(db, newerEvent, teamPlayerId, AcceptedStatusId, ExcusedAbsenceTypeId, excuseTypeId: 3);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.NotNull(result.LastAbsenceMatch);
            Assert.Equal(newerEvent, result.LastAbsenceMatch!.EventId);
            Assert.Equal(newerDate, result.LastAbsenceMatch.MatchDate);
            Assert.Equal("CD Rival Absence New", result.LastAbsenceMatch.RivalName);
            Assert.Equal(MatchEventTypeId, result.LastAbsenceMatch.EventTypeId);
            Assert.Equal("Partido", result.LastAbsenceMatch.EventTypeName);
            Assert.Equal("Enfermedad", result.LastAbsenceMatch.Reason);
        }

        [Fact]
        public async Task Handle_UnexcusedAbsenceWithoutReason_ReturnsNullReason()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "unexcused-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival Unexcused");

            var eventDate = DateTime.UtcNow.AddDays(-4).Date;
            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, eventDate, rivalId);
            await SeedConvocationAsync(db, eventId, teamPlayerId, AcceptedStatusId, UnexcusedAbsenceTypeId);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.NotNull(result.LastAbsenceMatch);
            Assert.Null(result.LastAbsenceMatch!.Reason);
        }

        [Fact]
        public async Task Handle_ConvocationsAcrossEventTypes_BreaksDownTotalsByTrainingFriendlyAndLeague()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "breakdown-player");
            var rivalId = await SeedRivalAsync(db, "CD Rival Breakdown");

            var training1 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-30), null);
            await SeedConvocationAsync(db, training1, teamPlayerId, AcceptedStatusId);
            var training2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-29), null);
            await SeedConvocationAsync(db, training2, teamPlayerId, AcceptedStatusId);

            var friendly1 = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-20), rivalId);
            await SeedConvocationAsync(db, friendly1, teamPlayerId, AcceptedStatusId);

            var league1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-10), rivalId);
            await SeedConvocationAsync(db, league1, teamPlayerId, AcceptedStatusId);
            var league2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5), rivalId);
            await SeedConvocationAsync(db, league2, teamPlayerId, AcceptedStatusId);
            var league3 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-1), rivalId);
            await SeedConvocationAsync(db, league3, teamPlayerId, AcceptedStatusId);

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Equal(6, result.TotalConvocations);
            Assert.Equal(2, result.TotalTrainingConvocations);
            Assert.Equal(1, result.TotalFriendlyConvocations);
            Assert.Equal(3, result.TotalLeagueConvocations);
        }

        [Fact]
        public async Task Handle_PlayerWithNoConvocationsOrParticipations_ReturnsZeroesAndNulls()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "empty-player");

            var handler = new GetPlayerConvocationSummary.Handler(db);
            var result = await handler.Handle(
                new GetPlayerConvocationSummary.PlayerConvocationSummaryQuery { TeamPlayerId = teamPlayerId },
                CancellationToken.None);

            Assert.Equal(0, result.TotalStarts);
            Assert.Equal(0, result.TotalConvocations);
            Assert.Equal(0, result.TotalTrainingConvocations);
            Assert.Equal(0, result.TotalFriendlyConvocations);
            Assert.Equal(0, result.TotalLeagueConvocations);
            Assert.Null(result.LastDeconvokedMatch);
            Assert.Null(result.LastAbsenceMatch);
        }
    }
}
