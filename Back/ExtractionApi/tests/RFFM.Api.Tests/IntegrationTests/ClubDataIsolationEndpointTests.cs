#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Teams.Commands;
using RFFM.Api.Features.Coaches.Teams.Queries;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Mobile.Competitions.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.IntegrationTests.MatchReportTestSupport;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// HTTP-level isolation checks through the test host on real PostgreSQL (openspec change
    /// personal-and-club-spaces, Step 7): an authenticated non-member gets not found for another club's
    /// team on read and on modification, and a player linked through a UserTeam row reads its own team.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubDataIsolationEndpointTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubDataIsolationEndpointTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record SeededTeam(Club Club, Team Team);

        private async Task<SeededTeam> SeedTeamAsync(string label)
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"S7 {label} Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"S7 {label} Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return new SeededTeam(club, team);
        }

        private async Task<string> CreateUserTeamLinkAsync(Team team)
        {
            var userId = $"s7-player-{Guid.NewGuid():N}";
            await using var db = _fixture.CreateDbContext();
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();
            return userId;
        }

        private static string NonMemberId() => $"s7-outsider-{Guid.NewGuid():N}";

        private async Task SeedFeaturePermissionsAsync()
        {
            await using var db = _fixture.CreateDbContext();
            var wanted = new[]
            {
                (CoachFeatureRoutes.ClubTeams, "Coach", PermissionType.ReadWrite),
                (CoachFeatureRoutes.CompetitionData, "Player", PermissionType.Read),
            };
            foreach (var (route, role, permission) in wanted)
            {
                var exists = await db.FeaturePermissions.AnyAsync(fp => fp.FeatureRoute == route && fp.RoleName == role);
                if (!exists)
                    db.FeaturePermissions.Add(new FeaturePermission("S7", route, role, permission));
            }

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Non_member_reading_team_of_another_club_gets_not_found()
        {
            var seeded = await SeedTeamAsync("Read");
            var outsider = NonMemberId();
            var (host, client) = await StartHostAsync(_fixture, new GetTeam());
            using var _ = host;

            var response = await client.SendAsync(Get($"/api/catalog/team/{seeded.Team.Id}", "Coach", outsider));

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Non_member_reading_team_of_another_club_gets_problem_details_body()
        {
            var seeded = await SeedTeamAsync("ReadBody");
            var outsider = NonMemberId();
            var (host, client) = await StartHostAsync(_fixture, new GetTeam());
            using var _ = host;

            var response = await client.SendAsync(Get($"/api/catalog/team/{seeded.Team.Id}", "Coach", outsider));

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(404, body.GetProperty("status").GetInt32());
        }

        [Fact]
        public async Task Non_member_modifying_team_of_another_club_gets_not_found_and_row_is_unchanged()
        {
            var seeded = await SeedTeamAsync("Write");
            await SeedFeaturePermissionsAsync();
            var originalName = seeded.Team.Name;
            var outsider = NonMemberId();
            var (host, client) = await StartHostAsync(_fixture, new UpdateTeam());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/team/{seeded.Team.Id}")
            {
                Content = JsonContent.Create(new
                {
                    teamModel = new
                    {
                        name = "Leaked by outsider",
                        categoryId = Category.NationalCategory.Id,
                        clubId = seeded.Club.Id,
                        seasonId = seeded.Team.SeasonId,
                        leagueId = (int?)null,
                        leagueGroup = (int?)null,
                        urlPhoto = (string?)null
                    }
                })
            };
            request.Headers.Add("X-Test-Role", "Coach");
            request.Headers.Add("X-Test-User-Id", outsider);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Teams.AsNoTracking().SingleAsync(t => t.Id == seeded.Team.Id);
            Assert.Equal(originalName, stored.Name);
        }

        [Fact]
        public async Task Player_linked_only_by_user_team_reads_own_team_through_mobile_calendar()
        {
            var seeded = await SeedTeamAsync("Calendar");
            var playerId = await CreateUserTeamLinkAsync(seeded.Team);
            await SeedFeaturePermissionsAsync();
            var calendarService = new Mock<ICalendarService>();
            var (host, client) = await StartHostAsync(_fixture, new GetTeamCalendar(), services =>
            {
                services.AddSingleton(calendarService.Object);
            });
            using var _ = host;

            var response = await client.SendAsync(Get($"/api/mobile/teams/{seeded.Team.Id}/calendar", "Player", playerId));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
