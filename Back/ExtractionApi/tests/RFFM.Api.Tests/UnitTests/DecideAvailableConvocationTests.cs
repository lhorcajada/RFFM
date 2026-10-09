#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Availability;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DecideAvailableConvocationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DecideAvailableConvocationTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static DecideAvailableConvocation.Handler CreateHandler(AppDbContext db, ICurrentUserService currentUser)
            => new(db, currentUser, new SanctionConvocationEnforcementService(db));

        private async Task<(string EventId, string TeamPlayerId, string RequestId, string CoachUserId)> SeedAsync(
            AppDbContext db, AvailabilityRequestStatus status)
        {
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var requestId = await SeedRequestAsync(db, eventId, teamPlayerId, status);
            var coachUserId = await SeedCoachAsync(db, teamId);
            return (eventId, teamPlayerId, requestId, coachUserId);
        }

        [Fact]
        public async Task Convoking_an_available_player_creates_an_accepted_convocation()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId, coachUserId) = await SeedAsync(db, AvailabilityRequestStatus.Available);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new DecideAvailableConvocation.DecideAvailableConvocationCommand(eventId, requestId, Convoke: true), CancellationToken.None);

            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(2, convocation.ConvocationStatusId);
            Assert.Null(convocation.ExcuseTypeId);
        }

        [Fact]
        public async Task Deconvoking_an_available_player_uses_technical_decision()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId, coachUserId) = await SeedAsync(db, AvailabilityRequestStatus.Available);

            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new DecideAvailableConvocation.DecideAvailableConvocationCommand(eventId, requestId, Convoke: false), CancellationToken.None);

            var convocation = await db.Convocations.AsNoTracking().SingleAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(5, convocation.ConvocationStatusId);
            Assert.Equal(ExcuseTypes.TechnicalDecision.Id, convocation.ExcuseTypeId);
        }

        [Fact]
        public async Task Deciding_on_a_request_that_is_not_available_is_a_conflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, requestId, coachUserId) = await SeedAsync(db, AvailabilityRequestStatus.Requested);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new DecideAvailableConvocation.DecideAvailableConvocationCommand(eventId, requestId, Convoke: true), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AvailabilityNotAvailable, ex.Code);
        }

        [Fact]
        public async Task Deciding_twice_is_a_conflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, requestId, coachUserId) = await SeedAsync(db, AvailabilityRequestStatus.Available);
            await SeedConvocationAsync(db, eventId, teamPlayerId, statusId: 2);

            var ex = await Assert.ThrowsAsync<ConflictException>(() => CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new DecideAvailableConvocation.DecideAvailableConvocationCommand(eventId, requestId, Convoke: false), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AvailabilityAlreadyDecided, ex.Code);
        }

        [Fact]
        public async Task User_who_cannot_manage_the_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, requestId, _) = await SeedAsync(db, AvailabilityRequestStatus.Available);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                .Handle(new DecideAvailableConvocation.DecideAvailableConvocationCommand(eventId, requestId, Convoke: true), CancellationToken.None).AsTask());
        }
    }
}
