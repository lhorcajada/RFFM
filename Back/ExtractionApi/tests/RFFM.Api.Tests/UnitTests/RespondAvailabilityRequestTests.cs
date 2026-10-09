#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Availability;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RespondAvailabilityRequestTests
    {
        private const int IllnessExcuseTypeId = 3;
        private const int TechnicalDecisionExcuseTypeId = 7;
        private const int SportiveSanctionExcuseTypeId = 8;

        private readonly PostgresContainerFixture _fixture;

        public RespondAvailabilityRequestTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static RespondAvailabilityRequest.Handler CreateHandler(
            AppDbContext db, ICurrentUserService currentUser, IWebPushNotificationDispatcher? dispatcher = null)
            => new(db, currentUser, new SanctionConvocationEnforcementService(db), dispatcher ?? Mock.Of<IWebPushNotificationDispatcher>());

        private async Task<(string EventId, string TeamPlayerId, string RequestId)> SeedRequestedAsync(AppDbContext db)
        {
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var requestId = await SeedRequestAsync(db, eventId, teamPlayerId, AvailabilityRequestStatus.Requested);
            return (eventId, teamPlayerId, requestId);
        }

        private static RespondAvailabilityRequest.RespondAvailabilityCommand Command(string eventId, string requestId, bool available, int? excuseTypeId = null)
            => new(eventId, requestId, available, excuseTypeId);

        [Fact]
        public async Task Player_says_yes_and_becomes_available_without_convocation()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId) = await SeedRequestedAsync(db);
            var userId = await SeedPlayerUserAsync(db, teamPlayerId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            await CreateHandler(db, CurrentUser(userId, "Player"), dispatcher.Object)
                .Handle(Command(eventId, requestId, available: true), CancellationToken.None);

            var request = await db.AvailabilityRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
            Assert.Equal(AvailabilityRequestStatus.Available.Id, request.StatusId);
            Assert.False(await db.Convocations.AnyAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId));
            dispatcher.Verify(d => d.DispatchAvailabilityRespondedAsync(requestId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Family_member_says_no_and_player_is_deconvoked_with_reason()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId) = await SeedRequestedAsync(db);
            var userId = await SeedPlayerUserAsync(db, teamPlayerId, "FamilyMember");

            await CreateHandler(db, CurrentUser(userId, "FamilyMember"))
                .Handle(Command(eventId, requestId, available: false, IllnessExcuseTypeId), CancellationToken.None);

            var request = await db.AvailabilityRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
            Assert.Equal(AvailabilityRequestStatus.Unavailable.Id, request.StatusId);
            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(5, convocation.ConvocationStatusId);
            Assert.Equal(IllnessExcuseTypeId, convocation.ExcuseTypeId);
        }

        [Fact]
        public async Task Player_cannot_respond_for_another_player()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, requestId) = await SeedRequestedAsync(db);
            var userId = await SeedPlayerUserAsync(db, "another-team-player");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(userId, "Player"))
                .Handle(Command(eventId, requestId, available: true), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Response_after_coach_decision_is_a_conflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId) = await SeedRequestedAsync(db);
            await SeedConvocationAsync(db, eventId, teamPlayerId, statusId: 2);
            var userId = await SeedPlayerUserAsync(db, teamPlayerId);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => CreateHandler(db, CurrentUser(userId, "Player"))
                .Handle(Command(eventId, requestId, available: false, IllnessExcuseTypeId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AvailabilityAlreadyDecided, ex.Code);
        }

        [Fact]
        public async Task Missing_request_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, _) = await SeedRequestedAsync(db);

            await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                .Handle(Command(eventId, Guid.NewGuid().ToString(), available: true), CancellationToken.None).AsTask());
        }

        private static async Task<string> SeedCoachOfEventTeamAsync(AppDbContext db, string eventId)
        {
            var teamId = await db.SportEvents.Where(se => se.Id == eventId).Select(se => se.TeamId).SingleAsync();
            return await SeedCoachAsync(db, teamId);
        }

        [Fact]
        public async Task Coach_confirms_player_availability_without_notifying_coaches()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, requestId) = await SeedRequestedAsync(db);
            var coachUserId = await SeedCoachOfEventTeamAsync(db, eventId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"), dispatcher.Object)
                .Handle(Command(eventId, requestId, available: true), CancellationToken.None);

            var request = await db.AvailabilityRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
            Assert.Equal(AvailabilityRequestStatus.Available.Id, request.StatusId);
            dispatcher.Verify(d => d.DispatchAvailabilityRespondedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Coach_marks_player_unavailable_with_reason()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId) = await SeedRequestedAsync(db);
            var coachUserId = await SeedCoachOfEventTeamAsync(db, eventId);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(Command(eventId, requestId, available: false, IllnessExcuseTypeId), CancellationToken.None);

            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(5, convocation.ConvocationStatusId);
            Assert.Equal(IllnessExcuseTypeId, convocation.ExcuseTypeId);
        }

        [Fact]
        public async Task Coach_of_another_team_cannot_confirm_availability()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, requestId) = await SeedRequestedAsync(db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                .Handle(Command(eventId, requestId, available: true), CancellationToken.None).AsTask());
        }

        [Fact]
        public void Validator_requires_reason_when_unavailable()
        {
            var result = new RespondAvailabilityRequest.Validator().Validate(Command("e", "r", available: false));
            Assert.False(result.IsValid);
        }

        [Theory]
        [InlineData(TechnicalDecisionExcuseTypeId)]
        [InlineData(SportiveSanctionExcuseTypeId)]
        public void Validator_rejects_coach_only_reasons(int excuseTypeId)
        {
            var result = new RespondAvailabilityRequest.Validator().Validate(Command("e", "r", available: false, excuseTypeId));
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_accepts_yes_without_reason()
        {
            var result = new RespondAvailabilityRequest.Validator().Validate(Command("e", "r", available: true));
            Assert.True(result.IsValid);
        }
    }
}
