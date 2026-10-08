#nullable enable
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using RFFM.Api.Features.Coaches.MatchReports;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.IntegrationTests.MatchReportTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>GET /api/teams/{teamId}/match-reports (openspec match-report D1).</summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamMatchReportsTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamMatchReportsTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<GetTeamMatchReports.MatchReportAvailability[]> GetReportsAsync(string teamId)
        {
            var (host, client) = await StartHostAsync(_fixture, new GetTeamMatchReports());
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/teams/{teamId}/match-reports"));
            Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
            return (await response.Content.ReadFromJsonAsync<GetTeamMatchReports.MatchReportAvailability[]>())!;
        }

        [Fact]
        public async Task LeagueMatchWithFinishedLiveMatch_HasBothReports()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var playerId = await SeedPlayerAsync(db, team, "liga-directo");
            var eventId = await SeedEventAsync(db, team.Id, LeagueEventTypeId, "123", "2", "1");
            await AddParticipationAsync(db, eventId, team.Id, playerId);

            var item = Assert.Single(await GetReportsAsync(team.Id));

            Assert.Equal(eventId, item.EventId);
            Assert.Equal("123", item.CodActa);
            Assert.True(item.HasLiveReport);
            Assert.True(item.HasFederationReport);
        }

        [Fact]
        public async Task LeagueMatchWithoutLiveMatch_HasOnlyFederationReport()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            await SeedEventAsync(db, team.Id, LeagueEventTypeId, "124", "0", "0");

            var item = Assert.Single(await GetReportsAsync(team.Id));

            Assert.False(item.HasLiveReport);
            Assert.True(item.HasFederationReport);
        }

        [Fact]
        public async Task FriendlyWithFinishedLiveMatch_HasOnlyLiveReport()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var playerId = await SeedPlayerAsync(db, team, "amistoso-directo");
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "3", "3");
            await AddParticipationAsync(db, eventId, team.Id, playerId);

            var item = Assert.Single(await GetReportsAsync(team.Id));

            Assert.True(item.HasLiveReport);
            Assert.False(item.HasFederationReport);
        }

        [Fact]
        public async Task FriendlyWithoutLiveMatch_IsNotReturned()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "1", "0");

            Assert.Empty(await GetReportsAsync(team.Id));
        }

        [Fact]
        public async Task LiveMatchNotFinished_HasNoLiveReport()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var playerId = await SeedPlayerAsync(db, team, "directo-en-curso");
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId);
            await AddParticipationAsync(db, eventId, team.Id, playerId, matchPhase: "secondHalf");

            Assert.Empty(await GetReportsAsync(team.Id));
        }

        [Fact]
        public async Task LeagueMatchWithoutScore_IsNotReturned()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            await SeedEventAsync(db, team.Id, LeagueEventTypeId, "125");

            Assert.Empty(await GetReportsAsync(team.Id));
        }

        [Fact]
        public async Task OnlyEventsOfTheRequestedTeamAreReturned()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var otherTeam = await SeedTeamAsync(db);
            await SeedEventAsync(db, otherTeam.Id, LeagueEventTypeId, "126", "1", "0");

            Assert.Empty(await GetReportsAsync(team.Id));
        }

        [Fact]
        public async Task FamilyMemberOfAnotherTeam_IsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var otherTeam = await SeedTeamAsync(db);
            var userId = await AddTeamMemberAsync(db, otherTeam.Id, RFFM.Api.Domain.Aggregates.UserClubs.Membership.FamilyPlayer);

            var (host, client) = await StartHostAsync(_fixture, new GetTeamMatchReports());
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/teams/{team.Id}/match-reports", "FamilyMember", userId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task PlayerOfTheTeam_CanReadReports()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            await SeedEventAsync(db, team.Id, LeagueEventTypeId, "127", "1", "1");
            var userId = await AddTeamMemberAsync(db, team.Id, RFFM.Api.Domain.Aggregates.UserClubs.Membership.Player);

            var (host, client) = await StartHostAsync(_fixture, new GetTeamMatchReports());
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/teams/{team.Id}/match-reports", "Player", userId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Single((await response.Content.ReadFromJsonAsync<GetTeamMatchReports.MatchReportAvailability[]>())!);
        }
    }
}
