#nullable enable
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetPlayerSeasonCardsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;
        private static readonly int FriendlyEventTypeId = SportEventType.FromName("Amistoso").Id;
        private static readonly int TrainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        public GetPlayerSeasonCardsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as GetEventAttendanceRosterHandlerTests.SeedTeamAndPlayerAsync.
        private async Task<(string TeamId, string ClubId, string SeasonId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"SeasonCards Test Club {Guid.NewGuid():N}", 1);
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
                Name = "SeasonCards Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, club.Id, season.Id);
        }

        private async Task<string> SeedTeamPlayerAsync(
            AppDbContext db, string teamId, string clubId, string seasonId, string alias, DemarcationModel? demarcation = null)
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
                FamilyMembers = new List<FamilyModel>(),
                Demarcation = demarcation
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        // SportEvent.SetEveDateTime/SetStartTime reject past dates, so seed via CreateNew (bypasses
        // domain date validation) same as EventRecurrencePersistenceTests / UpdateConvocationStatusHandlerTests.
        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, int eventTypeId, DateTime eveDateTime)
        {
            var sportEvent = RFFM.Api.Domain.Aggregates.Assistances.SportEvent.CreateNew(
                "SeasonCards Test Event",
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
            bool isStarter = true, string? goalsJson = null, string? cardsJson = null, string matchPhase = "finished")
        {
            var participation = MatchParticipation.Create(
                eventId, teamId, teamPlayerId,
                minutesPlayed: 90, isStarter: isStarter,
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
        public async Task Handle_TeamWithNoMatches_CurrentMatchdayIsOneForEveryPlayer()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-matches-player");

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, card.CurrentMatchday);
            Assert.Equal(0, card.MatchesPlayed);
        }

        [Fact]
        public async Task Handle_TeamWithFinishedMatches_CurrentMatchdayIsMatchesPlusOne()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "matchday-player");

            var baseDate = DateTime.UtcNow.AddDays(-30);
            for (var i = 0; i < 5; i++)
            {
                var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(i));
                await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId);
            }

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(6, card.CurrentMatchday);
            Assert.Equal(5, card.MatchesPlayed);
        }

        [Fact]
        public async Task Handle_FriendlyMatch_ExcludedFromAllMatchDerivedFields()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "friendly-player");

            var friendlyEventId = await SeedSportEventAsync(db, teamId, FriendlyEventTypeId, DateTime.UtcNow.AddDays(-10));
            var goalsJson = $"[{{\"scorerId\":\"{teamPlayerId}\",\"isOwnTeam\":true}}]";
            await SeedMatchParticipationAsync(db, friendlyEventId, teamId, teamPlayerId, goalsJson: goalsJson);

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, card.CurrentMatchday);
            Assert.Equal(0, card.MatchesPlayed);
            Assert.Equal(0, card.MatchesStarted);
            Assert.Equal(0, card.Goals);
            Assert.Equal(0, card.MatchesSinceLastDeconvocation);
        }

        [Fact]
        public async Task Handle_PlayerNeverDeconvoked_MatchesSinceLastDeconvocationEqualsMatchesPlayed()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "never-deconvoked-player");

            var baseDate = DateTime.UtcNow.AddDays(-20);
            for (var i = 0; i < 3; i++)
            {
                var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(i));
                await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId);
            }

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(3, card.MatchesPlayed);
            Assert.Equal(3, card.MatchesSinceLastDeconvocation);
        }

        [Fact]
        public async Task Handle_PlayerDeconvokedMidSeason_MatchesSinceLastDeconvocationCountsOnlyAfter()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "deconvoked-player");

            var baseDate = DateTime.UtcNow.AddDays(-30);

            // 2 matches before the deconvocation
            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate);
            await SeedMatchParticipationAsync(db, event1, teamId, teamPlayerId);
            var event2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(1));
            await SeedMatchParticipationAsync(db, event2, teamId, teamPlayerId);

            // Deconvocation on a match-type event
            var deconvokeEvent = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(2));
            await SeedConvocationAsync(db, deconvokeEvent, teamPlayerId, DeconvokeStatusId);

            // 3 further finished matches after the deconvocation event's date
            for (var i = 3; i < 6; i++)
            {
                var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(i));
                await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId);
            }

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(5, card.MatchesPlayed); // 2 before + 3 after (deconvocation event itself has no participation row)
            Assert.Equal(3, card.MatchesSinceLastDeconvocation);
        }

        [Fact]
        public async Task Handle_TrainingDeconvocation_DoesNotAffectMatchesSinceLastDeconvocation()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "training-deconvoked-player");

            var baseDate = DateTime.UtcNow.AddDays(-15);
            for (var i = 0; i < 4; i++)
            {
                var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, baseDate.AddDays(i));
                await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId);
            }

            // Deconvocation on a training event should be ignored for MatchesSinceLastDeconvocation.
            var trainingEvent = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baseDate.AddDays(1));
            await SeedConvocationAsync(db, trainingEvent, teamPlayerId, DeconvokeStatusId);

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(4, card.MatchesPlayed);
            Assert.Equal(4, card.MatchesSinceLastDeconvocation);
        }

        [Fact]
        public async Task Handle_CardsJson_ParsesYellowAndRedCardsPerPlayer()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "carded-player");
            var otherTeamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "other-player");

            var eventId = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5));
            var cardsJson = $"[{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}," +
                             $"{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Yellow\"}}," +
                             $"{{\"teamPlayerId\":\"{teamPlayerId}\",\"cardType\":\"Red\"}}," +
                             $"{{\"teamPlayerId\":\"{otherTeamPlayerId}\",\"cardType\":\"Yellow\"}}]";
            await SeedMatchParticipationAsync(db, eventId, teamId, teamPlayerId, cardsJson: cardsJson);
            await SeedMatchParticipationAsync(db, eventId, teamId, otherTeamPlayerId, cardsJson: cardsJson);

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(2, card.YellowCards);
            Assert.Equal(1, card.RedCards);

            var otherCard = Assert.Single(result, c => c.TeamPlayerId == otherTeamPlayerId);
            Assert.Equal(1, otherCard.YellowCards);
            Assert.Equal(0, otherCard.RedCards);
        }

        [Fact]
        public async Task Handle_NullOrMalformedCardsJson_ContributesZeroCards()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "null-cards-player");

            var event1 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-5));
            await SeedMatchParticipationAsync(db, event1, teamId, teamPlayerId, cardsJson: null);

            var event2 = await SeedSportEventAsync(db, teamId, MatchEventTypeId, DateTime.UtcNow.AddDays(-4));
            await SeedMatchParticipationAsync(db, event2, teamId, teamPlayerId, cardsJson: "{not-a-valid-array}");

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(0, card.YellowCards);
            Assert.Equal(0, card.RedCards);
        }

        [Fact]
        public async Task Handle_TrainingAttendance_MatchesExpectedAttendedAbsentPossibleCounts()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "training-attendance-player");

            var baseDate = DateTime.UtcNow.AddDays(-20);
            var trainingEvent1 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baseDate);
            await SeedConvocationAsync(db, trainingEvent1, teamPlayerId, ConvocationStatus.FromName("Accepted").Id, AssistanceType.Attendance.Id);

            var trainingEvent2 = await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baseDate.AddDays(1));
            await SeedConvocationAsync(db, trainingEvent2, teamPlayerId, ConvocationStatus.FromName("Accepted").Id, AssistanceType.UnexcusedAbsence.Id);

            // Third training: no convocation row at all -> counts toward TrainingsPossible only.
            await SeedSportEventAsync(db, teamId, TrainingEventTypeId, baseDate.AddDays(2));

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Equal(1, card.TrainingsAttended);
            Assert.Equal(1, card.TrainingsAbsent);
            Assert.Equal(3, card.TrainingsPossible);
            Assert.True(card.TrainingsAttended + card.TrainingsAbsent <= card.TrainingsPossible);
        }

        [Fact]
        public async Task Handle_PlayerWithDemarcationSet_ReturnsActiveAndPossibleDemarcations()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var demarcation = new DemarcationModel
            {
                ActivePositionId = DemarcationMaster.GoalKeeper.Id,
                PossibleDemarcations = new List<int> { DemarcationMaster.GoalKeeper.Id, DemarcationMaster.CenterBack.Id }
            };
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "demarcation-player", demarcation);

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.NotNull(card.ActiveDemarcation);
            Assert.Equal(DemarcationMaster.GoalKeeper.Id, card.ActiveDemarcation!.Id);
            Assert.Equal(DemarcationMaster.GoalKeeper.Name, card.ActiveDemarcation.Name);
            Assert.Equal(DemarcationMaster.GoalKeeper.Code, card.ActiveDemarcation.Code);

            Assert.Equal(2, card.PossibleDemarcations.Length);
            Assert.Contains(card.PossibleDemarcations, d => d.Id == DemarcationMaster.GoalKeeper.Id && d.Code == DemarcationMaster.GoalKeeper.Code);
            Assert.Contains(card.PossibleDemarcations, d => d.Id == DemarcationMaster.CenterBack.Id && d.Code == DemarcationMaster.CenterBack.Code);
        }

        [Fact]
        public async Task Handle_PlayerWithNoDemarcation_ReturnsNullActiveAndEmptyPossibleDemarcations()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedTeamPlayerAsync(db, teamId, clubId, seasonId, "no-demarcation-player");

            var handler = new GetPlayerSeasonCards.Handler(db);
            var query = new GetPlayerSeasonCards.PlayerSeasonCardsQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var card = Assert.Single(result, c => c.TeamPlayerId == teamPlayerId);
            Assert.Null(card.ActiveDemarcation);
            Assert.Empty(card.PossibleDemarcations);
        }
    }
}
