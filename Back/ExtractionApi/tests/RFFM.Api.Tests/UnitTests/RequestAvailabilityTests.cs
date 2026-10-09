#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Features.Coaches.Availability;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class RequestAvailabilityTests
    {
        private readonly PostgresContainerFixture _fixture;

        public RequestAvailabilityTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static RequestAvailability.Handler CreateHandler(
            AppDbContext db, ICurrentUserService currentUser, IWebPushNotificationDispatcher? dispatcher = null)
            => new(db, currentUser, dispatcher ?? Mock.Of<IWebPushNotificationDispatcher>());

        [Fact]
        public async Task Coach_requests_availability_for_every_waiting_player()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            for (var i = 0; i < 3; i++) await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var coachUserId = await SeedCoachAsync(db, teamId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"), dispatcher.Object)
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None);

            Assert.Equal(3, result.RequestedCount);
            var requests = await db.AvailabilityRequests.AsNoTracking().Where(r => r.SportEventId == eventId).ToListAsync();
            Assert.Equal(3, requests.Count);
            Assert.All(requests, r => Assert.Equal(AvailabilityRequestStatus.Requested.Id, r.StatusId));
            dispatcher.Verify(d => d.DispatchAvailabilityRequestedAsync(It.IsAny<string>(), eventId, It.IsAny<CancellationToken>()), Times.Exactly(3));
        }

        [Fact]
        public async Task Convoked_injured_and_sanctioned_players_are_skipped()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var convoked = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var injured = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var sanctioned = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var available = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId, DateTime.UtcNow.AddDays(3));
            await SeedConvocationAsync(db, eventId, convoked, statusId: 1);
            db.TeamPlayerInjuries.Add(TeamPlayerInjury.Create(injured, DateTime.UtcNow.AddDays(-2), "Muscular", null, null));
            db.TeamPlayerSanctions.Add(TeamPlayerSanction.CreateAutomatic(
                sanctioned, SanctionCategory.Competition, DateTime.UtcNow.AddDays(-1), "Tarjeta roja", "Roja directa", "source-event"));
            await db.SaveChangesAsync();
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None);

            Assert.Equal(1, result.RequestedCount);
            var request = await db.AvailabilityRequests.AsNoTracking().SingleAsync(r => r.SportEventId == eventId);
            Assert.Equal(available, request.TeamPlayerId);
        }

        [Fact]
        public async Task Requesting_twice_creates_nothing_new_and_sends_no_new_notifications()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var coachUserId = await SeedCoachAsync(db, teamId);
            await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"), dispatcher.Object)
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None);

            Assert.Equal(0, result.RequestedCount);
            Assert.Equal(1, await db.AvailabilityRequests.CountAsync(r => r.SportEventId == eventId));
            dispatcher.Verify(d => d.DispatchAvailabilityRequestedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Unavailable_request_without_convocation_is_reopened()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var requestId = await SeedRequestAsync(db, eventId, teamPlayerId, AvailabilityRequestStatus.Unavailable);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None);

            Assert.Equal(1, result.RequestedCount);
            var request = await db.AvailabilityRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
            Assert.Equal(AvailabilityRequestStatus.Requested.Id, request.StatusId);
        }

        [Theory]
        [InlineData(FriendlyTypeId)]
        [InlineData(TrainingTypeId)]
        public async Task Non_league_events_are_rejected(int eventTypeId)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, eventTypeId);
            var coachUserId = await SeedCoachAsync(db, teamId);

            var ex = await Assert.ThrowsAsync<DomainException>(() => CreateHandler(db, CurrentUser(coachUserId, "Coach"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.AvailabilityOnlyForLeagueMatches, ex.Code);
        }

        [Fact]
        public async Task User_who_cannot_manage_the_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(db);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(eventId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Missing_event_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator"))
                .Handle(new RequestAvailability.RequestAvailabilityCommand(Guid.NewGuid().ToString()), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Get_lists_requests_with_status_names()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var p1 = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var p2 = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            await SeedRequestAsync(db, eventId, p1, AvailabilityRequestStatus.Requested);
            await SeedRequestAsync(db, eventId, p2, AvailabilityRequestStatus.Available);

            var result = await new GetEventAvailabilityRequests.Handler(db)
                .Handle(new GetEventAvailabilityRequests.EventAvailabilityRequestsQuery { EventId = eventId, TeamId = teamId }, CancellationToken.None);

            Assert.Equal(2, result.Length);
            Assert.Contains(result, r => r.TeamPlayerId == p1 && r.Status == "Requested");
            Assert.Contains(result, r => r.TeamPlayerId == p2 && r.Status == "Available" && r.RespondedAt != null);
        }
    }
}
