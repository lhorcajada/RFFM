#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
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
    public class SendAvailabilityRemindersTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SendAvailabilityRemindersTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static SendAvailabilityReminders.Handler CreateHandler(
            AppDbContext db, ICurrentUserService currentUser, IWebPushNotificationDispatcher? dispatcher = null)
            => new(db, currentUser, dispatcher ?? Mock.Of<IWebPushNotificationDispatcher>());

        [Fact]
        public async Task Coach_reminds_selected_players_still_pending_to_answer()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            await SeedRequestAsync(db, eventId, teamPlayerId, AvailabilityRequestStatus.Requested);
            var coachUserId = await SeedCoachAsync(db, teamId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"), dispatcher.Object).Handle(
                new SendAvailabilityReminders.SendAvailabilityRemindersCommand(eventId, new[] { teamPlayerId }),
                CancellationToken.None);

            Assert.Equal(1, result.NotifiedCount);
            dispatcher.Verify(d => d.DispatchAvailabilityRequestedAsync(teamPlayerId, eventId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(nameof(AvailabilityRequestStatus.Available))]
        [InlineData(nameof(AvailabilityRequestStatus.Unavailable))]
        public async Task Players_who_already_answered_are_skipped(string statusName)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            var status = statusName == nameof(AvailabilityRequestStatus.Available)
                ? AvailabilityRequestStatus.Available
                : AvailabilityRequestStatus.Unavailable;
            await SeedRequestAsync(db, eventId, teamPlayerId, status);
            var coachUserId = await SeedCoachAsync(db, teamId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            var result = await CreateHandler(db, CurrentUser(coachUserId, "Coach"), dispatcher.Object).Handle(
                new SendAvailabilityReminders.SendAvailabilityRemindersCommand(eventId, new[] { teamPlayerId }),
                CancellationToken.None);

            Assert.Equal(0, result.NotifiedCount);
            dispatcher.Verify(d => d.DispatchAvailabilityRequestedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task User_who_cannot_manage_the_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);
            await SeedRequestAsync(db, eventId, teamPlayerId, AvailabilityRequestStatus.Requested);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach")).Handle(
                new SendAvailabilityReminders.SendAvailabilityRemindersCommand(eventId, new[] { teamPlayerId }),
                CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Missing_event_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Administrator")).Handle(
                new SendAvailabilityReminders.SendAvailabilityRemindersCommand(Guid.NewGuid().ToString(), new[] { "tp-1" }),
                CancellationToken.None).AsTask());
        }

        [Fact]
        public void Validator_rejects_empty_team_player_ids()
        {
            var result = new SendAvailabilityReminders.Validator().Validate(
                new SendAvailabilityReminders.SendAvailabilityRemindersCommand("event-1", Array.Empty<string>()));

            Assert.False(result.IsValid);
        }
    }
}
