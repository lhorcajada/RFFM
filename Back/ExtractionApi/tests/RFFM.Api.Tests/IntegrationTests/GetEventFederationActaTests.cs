#nullable enable
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Features.Coaches.MatchReports;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.IntegrationTests.MatchReportTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>GET /api/events/{eventId}/federation-acta (openspec match-report D3).</summary>
    [Collection(PostgresCollection.Name)]
    public class GetEventFederationActaTests
    {
        private const int CurrentSeasonId = 22;

        private readonly PostgresContainerFixture _fixture;

        public GetEventFederationActaTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(HttpStatusCode Status, Mock<IActaService> Acta)> RequestAsync(string eventId, MatchRffm? acta, string role = "Coach", string? userId = null)
        {
            var actaService = new Mock<IActaService>();
            actaService
                .Setup(s => s.GetMatchFromActaAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(acta);

            var (host, client) = await StartHostAsync(_fixture, new GetEventFederationActa(), services =>
            {
                services.AddSingleton(actaService.Object);
                services.Configure<RffmOptions>(o => o.CurrentSeasonId = CurrentSeasonId);
            });
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/events/{eventId}/federation-acta", role, userId));
            return (response.StatusCode, actaService);
        }

        private async Task<(string EventId, string TeamId)> SeedLeagueEventAsync(string codActa = "777")
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            team.UpdateRffmCompetitionId(100);
            team.UpdateRffmGroupId(200);
            await db.SaveChangesAsync();
            var eventId = await SeedEventAsync(db, team.Id, LeagueEventTypeId, codActa, "1", "0");
            return (eventId, team.Id);
        }

        [Fact]
        public async Task LeagueMatch_RequestsActaWithTeamCompetitionGroupAndCurrentSeason()
        {
            var (eventId, teamId) = await SeedLeagueEventAsync();
            await using var db = _fixture.CreateDbContext();
            var userId = await AddTeamMemberAsync(db, teamId, Membership.Player);

            var (status, acta) = await RequestAsync(eventId, new MatchRffm(), "Player", userId);

            Assert.Equal(HttpStatusCode.OK, status);
            acta.Verify(s => s.GetMatchFromActaAsync("777", CurrentSeasonId, 100, 200, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Friendly_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, "778", "1", "0");

            var (status, _) = await RequestAsync(eventId, new MatchRffm());

            Assert.Equal(HttpStatusCode.NotFound, status);
        }

        [Fact]
        public async Task ActaServiceReturnsNull_ReturnsNotFound()
        {
            var (eventId, _) = await SeedLeagueEventAsync("779");

            var (status, _) = await RequestAsync(eventId, null);

            Assert.Equal(HttpStatusCode.NotFound, status);
        }

        [Fact]
        public async Task TeamWithoutRffmCompetition_ReturnsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var eventId = await SeedEventAsync(db, team.Id, LeagueEventTypeId, "780", "1", "0");

            var (status, _) = await RequestAsync(eventId, new MatchRffm());

            Assert.Equal(HttpStatusCode.NotFound, status);
        }
    }
}
