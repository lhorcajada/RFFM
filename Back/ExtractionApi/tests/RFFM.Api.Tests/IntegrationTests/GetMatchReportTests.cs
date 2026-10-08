#nullable enable
using System;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Formations;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.MatchReports;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.IntegrationTests.MatchReportTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>GET /api/events/{eventId}/match-report (openspec match-report D2).</summary>
    [Collection(PostgresCollection.Name)]
    public class GetMatchReportTests
    {
        private const int AcceptedStatusId = 2;

        private readonly PostgresContainerFixture _fixture;

        public GetMatchReportTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<GetMatchReport.MatchReportResponse> GetReportAsync(string eventId, string role = "Coach", string? userId = null)
        {
            var (host, client) = await StartHostAsync(_fixture, new GetMatchReport());
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/events/{eventId}/match-report", role, userId));
            Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
            return (await response.Content.ReadFromJsonAsync<GetMatchReport.MatchReportResponse>())!;
        }

        private static async Task ConvocateAsync(AppDbContext db, string eventId, string teamPlayerId)
        {
            db.Convocations.Add(Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayerId,
                ConvocationStatusId = AcceptedStatusId,
                ResponseDateTime = DateTime.UtcNow.AddMinutes(-5)
            }));
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task StartersTakeTheirSlotsFromTheStoredStartingLineup()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var keeper = await SeedPlayerAsync(db, team, $"portero-{Guid.NewGuid():N}", 1);
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "1", "0");
            var lineup = $"{{\"formationId\":\"f\",\"formationName\":\"4-4-2\",\"slots\":{{\"0\":\"{keeper}\"}}}}";
            await AddParticipationAsync(db, eventId, team.Id, keeper, startingLineupJson: lineup);

            var report = await GetReportAsync(eventId);

            Assert.True(report.HasLiveReport);
            Assert.False(report.HasFederationReport);
            Assert.Equal("Friendly", report.MatchCategory);
            Assert.Equal("4-4-2", report.Live!.FormationName);
            var starter = Assert.Single(report.Live.Starters);
            Assert.Equal(keeper, starter.TeamPlayerId);
            Assert.Equal(0, starter.SlotIndex);
            Assert.Equal(1, starter.Dorsal);
        }

        [Fact]
        public async Task WithoutStoredLineup_FallsBackToTheEventLineup()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var striker = await SeedPlayerAsync(db, team, $"delantero-{Guid.NewGuid():N}", 9);
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "1", "0");
            await AddParticipationAsync(db, eventId, team.Id, striker);

            var formationName = $"F-{Guid.NewGuid():N}".Substring(0, 12);
            var formation = Formation.Create(formationName);
            db.Formations.Add(formation);
            await db.SaveChangesAsync();
            var eventLineup = TeamIdealLineup.Create(team.Id, eventId, formation.Id);
            db.TeamIdealLineups.Add(eventLineup);
            await db.SaveChangesAsync();
            db.TeamIdealLineupSlots.Add(TeamIdealLineupSlot.Create(eventLineup.Id, 10, striker));
            await db.SaveChangesAsync();

            var report = await GetReportAsync(eventId);

            Assert.Equal(formationName, report.Live!.FormationName);
            Assert.Equal(10, Assert.Single(report.Live.Starters).SlotIndex);
        }

        [Fact]
        public async Task ConvocatedPlayerWhoDidNotPlay_IsOnTheBenchWithZeroMinutes()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var starter = await SeedPlayerAsync(db, team, $"titular-{Guid.NewGuid():N}");
            var reserve = await SeedPlayerAsync(db, team, $"reserva-{Guid.NewGuid():N}");
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "0", "0");
            await ConvocateAsync(db, eventId, starter);
            await ConvocateAsync(db, eventId, reserve);
            await AddParticipationAsync(db, eventId, team.Id, starter);

            var report = await GetReportAsync(eventId);

            var bench = Assert.Single(report.Live!.Bench);
            Assert.Equal(reserve, bench.TeamPlayerId);
            Assert.Equal(0, bench.MinutesPlayed);
        }

        [Fact]
        public async Task EventWithoutLiveMatch_ReturnsHeaderWithoutLiveSection()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var eventId = await SeedEventAsync(db, team.Id, LeagueEventTypeId, "555", "2", "2");

            var report = await GetReportAsync(eventId);

            Assert.Null(report.Live);
            Assert.False(report.HasLiveReport);
            Assert.True(report.HasFederationReport);
            Assert.Equal("League", report.MatchCategory);
            Assert.Equal("2", report.LocalGoals);
        }

        [Fact]
        public async Task UnknownEvent_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(_fixture, new GetMatchReport());
            using var _ = host;

            var response = await client.SendAsync(Get($"/api/events/{Guid.NewGuid()}/match-report"));

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task PlayerOfTheTeam_CanReadTheReport()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var playerId = await SeedPlayerAsync(db, team, $"jugador-{Guid.NewGuid():N}");
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "1", "0");
            await AddParticipationAsync(db, eventId, team.Id, playerId);
            var userId = await AddTeamMemberAsync(db, team.Id, Membership.Player);

            var report = await GetReportAsync(eventId, "Player", userId);

            Assert.NotNull(report.Live);
        }

        [Fact]
        public async Task PlayerOfAnotherTeam_IsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var team = await SeedTeamAsync(db);
            var otherTeam = await SeedTeamAsync(db);
            var eventId = await SeedEventAsync(db, team.Id, FriendlyEventTypeId, null, "1", "0");
            var userId = await AddTeamMemberAsync(db, otherTeam.Id, Membership.Player);

            var (host, client) = await StartHostAsync(_fixture, new GetMatchReport());
            using var _ = host;
            var response = await client.SendAsync(Get($"/api/events/{eventId}/match-report", "Player", userId));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
    }
}
