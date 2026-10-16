#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class AddConvocationsNotificationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public AddConvocationsNotificationTests(PostgresContainerFixture fixture) => _fixture = fixture;

        [Theory]
        [InlineData(LeagueMatchTypeId, 0)]
        [InlineData(TrainingTypeId, 1)]
        public async Task Single_convocation_notifies_player_except_in_league_matches(int eventTypeId, int expectedDispatches)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, eventTypeId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            await new AddConvocations.AddConvocationHandler(db, dispatcher.Object).Handle(
                new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId }, CancellationToken.None);

            dispatcher.Verify(d => d.DispatchConvocationCreatedAsync(teamPlayerId, eventId, It.IsAny<CancellationToken>()),
                Times.Exactly(expectedDispatches));
        }

        [Fact]
        public async Task Single_convocation_returns_the_id_of_the_created_convocation()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, LeagueMatchTypeId);

            var response = await new AddConvocations.AddConvocationHandler(db, new Mock<IWebPushNotificationDispatcher>().Object).Handle(
                new AddConvocations.AddConvocationRequest { EventId = eventId, TeamPlayerId = teamPlayerId }, CancellationToken.None);

            var stored = await db.Convocations.SingleAsync(c => c.SportEventId == eventId && c.TeamPlayerId == teamPlayerId);
            Assert.Equal(stored.Id, response.Id);
        }

        [Theory]
        [InlineData(LeagueMatchTypeId, 0)]
        [InlineData(TrainingTypeId, 2)]
        public async Task Bulk_convocation_notifies_players_except_in_league_matches(int eventTypeId, int expectedDispatches)
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            await SeedPlayerAsync(db, teamId, clubId, seasonId);
            await SeedPlayerAsync(db, teamId, clubId, seasonId);
            var eventId = await SeedEventAsync(db, teamId, eventTypeId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            await new AddConvocations.BulkAddConvocationHandler(db, dispatcher.Object).Handle(
                new AddConvocations.BulkAddConvocationsRequest { EventId = eventId }, CancellationToken.None);

            dispatcher.Verify(d => d.DispatchConvocationCreatedAsync(It.IsAny<string>(), eventId, It.IsAny<CancellationToken>()),
                Times.Exactly(expectedDispatches));
        }
    }
}
