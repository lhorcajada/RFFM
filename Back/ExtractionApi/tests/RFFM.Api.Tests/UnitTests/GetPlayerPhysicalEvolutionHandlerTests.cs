#nullable enable
using RFFM.Api.Common;
using RFFM.Api.Domain;
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
    public class GetPlayerPhysicalEvolutionHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;

        public GetPlayerPhysicalEvolutionHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db, int categoryId)
        {
            var club = Club.Create($"Evolution Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase { Name = "Evolution Test Team", CategoryId = categoryId, ClubId = club.Id, SeasonId = season.Id });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private static async Task<string> SeedTeamPlayerAsync(AppDbContext db, string teamId, string clubId, string seasonId)
        {
            var player = Player.Create(new PlayerModelBase { Name = "Test", LastName = "Player", Alias = $"evo-{Guid.NewGuid():N}", ClubId = clubId });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow.AddDays(-200),
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        private static async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime, List<string>? trainingTypes = null)
        {
            var sportEvent = SportEvent.CreateNew("Evolution Test Event", eveDateTime, eveDateTime, null, null, null, null,
                eventTypeId, teamId, null, trainingTypes: trainingTypes);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private static async Task SeedParticipationAsync(AppDbContext db, string eventId, string teamId, string teamPlayerId, int minutesPlayed)
        {
            db.MatchParticipations.Add(MatchParticipation.Create(
                eventId, teamId, teamPlayerId, minutesPlayed: minutesPlayed, isStarter: true, enteredAtMinute: 0, exitedAtMinute: null,
                scoreLocal: 1, scoreVisitor: 0, matchPhase: "finished", substitutionWindowsJson: null, ratingSnapshotsJson: null,
                goalsJson: null, cardsJson: null));
            await db.SaveChangesAsync();
        }

        private static async Task SeedConvocationAsync(AppDbContext db, string eventId, string teamPlayerId, int assistanceTypeId)
        {
            db.Convocations.Add(Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                AssistanceTypeId = assistanceTypeId,
                ResponseDateTime = DateTime.UtcNow.AddDays(-1),
                ConvocationStatusId = null,
                ExcuseTypeId = null
            }));
            await db.SaveChangesAsync();
        }

        // Entreno físico hace 3 días (asiste), entreno hace 1 día (falta), partido de 60' hace 2 días.
        private static async Task<(string TeamId, string TeamPlayerId, string AttendedTraining, string MissedTraining, string Match)> SeedActivePlayerAsync(
            AppDbContext db, int categoryId)
        {
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db, categoryId);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId);

            var attended = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-3), new List<string> { "Fisico" });
            await SeedConvocationAsync(db, attended, teamPlayerId, AssistanceType.Attendance.Id);
            var missed = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, DateTime.UtcNow.AddDays(-1));
            await SeedConvocationAsync(db, missed, teamPlayerId, AssistanceType.UnexcusedAbsence.Id);
            var match = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-2));
            await SeedParticipationAsync(db, match, teamId, teamPlayerId, 60);

            return (teamId, teamPlayerId, attended, missed, match);
        }

        private static Task<GetPlayerPhysicalEvolution.PlayerPhysicalEvolutionDto> HandleAsync(AppDbContext db, string teamId, string teamPlayerId, int days = 28) =>
            new GetPlayerPhysicalEvolution.Handler(db)
                .Handle(new GetPlayerPhysicalEvolution.Query { TeamId = teamId, TeamPlayerId = teamPlayerId, Days = days }, CancellationToken.None)
                .AsTask();

        [Fact]
        public async Task ReturnsOnePointPerDayOfTheRange_EndingToday()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _, _, _) = await SeedActivePlayerAsync(db, Category.U14.Id);

            var result = await HandleAsync(db, teamId, teamPlayerId, days: 56);

            Assert.Equal(56, result.Points.Length);
            Assert.Equal(DateTime.UtcNow.Date.AddDays(-55), result.Points[0].Date);
            Assert.Equal(DateTime.UtcNow.Date, result.Points[^1].Date);
        }

        [Fact]
        public async Task LastPoint_MatchesTheTeamStatistics()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _, _, _) = await SeedActivePlayerAsync(db, Category.U14.Id);

            var result = await HandleAsync(db, teamId, teamPlayerId);
            var stats = await new GetTeamPlayerStatistics.Handler(db).Handle(new GetTeamPlayerStatistics.Query { TeamId = teamId }, CancellationToken.None);

            var row = Assert.Single(stats, p => p.TeamPlayerId == teamPlayerId);
            var today = result.Points[^1];
            Assert.True(result.FormStatusAvailable);
            Assert.NotNull(today.FormStatus);
            Assert.Equal(row.FormStatus, today.FormStatus);
            Assert.Equal(row.Readiness, today.Readiness);
            Assert.Equal(row.Fatigue, today.Fatigue);
        }

        [Fact]
        public async Task Events_OnlyIncludeAttendedTrainingsAndPlayedMatches()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, attended, _, match) = await SeedActivePlayerAsync(db, Category.U14.Id);

            var result = await HandleAsync(db, teamId, teamPlayerId);

            Assert.Collection(result.Events.OrderBy(e => e.Date),
                e => { Assert.Equal(attended, e.EventId); Assert.Equal("Training", e.Kind); Assert.Equal(new[] { "Fisico" }, e.TrainingTypes); },
                e => { Assert.Equal(match, e.EventId); Assert.Equal("Match", e.Kind); Assert.Equal(60, e.MinutesPlayed); });
        }

        [Fact]
        public async Task ActiveInjuryInsideTheRange_IsReturnedWithoutEndDate()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _, _, _) = await SeedActivePlayerAsync(db, Category.U14.Id);
            db.TeamPlayerInjuries.Add(TeamPlayerInjury.Create(teamPlayerId, DateTime.UtcNow.AddDays(-5), "Muscular", null, null));
            db.TeamPlayerInjuries.Add(TeamPlayerInjury.Create(teamPlayerId, DateTime.UtcNow.AddDays(-150), "Muscular", null, null));
            await db.SaveChangesAsync();
            var oldInjury = db.TeamPlayerInjuries.Single(i => i.TeamPlayerId == teamPlayerId && i.StartDate < DateTime.UtcNow.AddDays(-100));
            oldInjury.Update(oldInjury.StartDate, "Muscular", null, null, DateTime.UtcNow.AddDays(-140));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, teamId, teamPlayerId);

            var injury = Assert.Single(result.Injuries);
            Assert.Null(injury.EndDate);
        }

        [Fact]
        public async Task CategoryWithoutStandardMinutes_HasNoFormStatus()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _, _, _) = await SeedActivePlayerAsync(db, Category.NationalCategory.Id);

            var result = await HandleAsync(db, teamId, teamPlayerId);

            Assert.False(result.FormStatusAvailable);
            Assert.All(result.Points, p => Assert.Null(p.FormStatus));
            Assert.NotNull(result.Points[^1].Readiness);
        }

        [Fact]
        public async Task PlayerFromAnotherTeam_IsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, teamPlayerId, _, _, _) = await SeedActivePlayerAsync(db, Category.U14.Id);
            var (otherTeamId, _, _) = await SeedTeamAsync(db, Category.U14.Id);

            await Assert.ThrowsAsync<NotFoundException>(() => HandleAsync(db, otherTeamId, teamPlayerId));
        }

        [Theory]
        [InlineData(28, true)]
        [InlineData(56, true)]
        [InlineData(84, true)]
        [InlineData(30, false)]
        [InlineData(0, false)]
        public void Validator_OnlyAcceptsFourEightOrTwelveWeeks(int days, bool isValid)
        {
            var result = new GetPlayerPhysicalEvolution.Validator()
                .Validate(new GetPlayerPhysicalEvolution.Query { TeamId = "t", TeamPlayerId = "p", Days = days });

            Assert.Equal(isValid, result.IsValid);
        }
    }
}
