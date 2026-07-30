#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for SetPlayerSanction: role-gated writes (Coach/Administrator only), open GET,
    /// category filtering and validation, and 404s for unknown team players/sanctions. Mirrors
    /// InjuryEndpointAuthorizationTests's host bootstrap exactly — see that file for rationale
    /// on why this uses a real Postgres TestServer instead of the InMemory provider (FK to
    /// TeamPlayer is enforced by Postgres).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class SanctionEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SanctionEndpointAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values)
                    ? values.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync(IFeatureModule module)
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddAuthentication(TestAuthHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddDbContext<AppDbContext>(options =>
                            {
                                options.UseNpgsql(_fixture.ConnectionString, npgsql =>
                                {
                                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                                });
                            });
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => module.AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        private async Task<string> CreateTeamPlayerAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Sanction Auth Test Club {Guid.NewGuid():N}", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Sanction Auth Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task<string> CreateSanctionAsync(string teamPlayerId, SanctionCategory category)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var sanction = TeamPlayerSanction.Create(teamPlayerId, category, DateTime.UtcNow, "Expulsión", "Test sanction", "2 partidos");
            setupDb.TeamPlayerSanctions.Add(sanction);
            await setupDb.SaveChangesAsync();

            return sanction.Id;
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreatePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", "Test", "2 partidos"))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithCoachRoleAndCompetitionCategory_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", "Test", "2 partidos"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body);
            Assert.Equal("Competition", body!.Category);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithCoachRoleAndInternalDisciplineCategory_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("InternalDiscipline", DateTime.UtcNow, "Incumplimiento de normas", "Llegó tarde", null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body);
            Assert.Equal("InternalDiscipline", body!.Category);
        }

        [Fact]
        public async Task CreatePlayerSanction_WithUnknownCategory_ReturnsBadRequest()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("NotACategory", DateTime.UtcNow, "Expulsión", null, null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreatePlayerSanction_ForNonExistentTeamPlayer_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/catalog/teamplayer/does-not-exist/sanctions")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionCreateRequest("Competition", DateTime.UtcNow, "Expulsión", null, null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdatePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("Competition", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", null))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdatePlayerSanction_WithCoachRole_UpdatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("InternalDiscipline", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.Equal("InternalDiscipline", body!.Category);
        }

        [Fact]
        public async Task UpdatePlayerSanction_SettingEndDate_LiftsSanction()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var endDate = DateTime.UtcNow;
            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}")
            {
                Content = JsonContent.Create(new SetPlayerSanction.SanctionUpdateRequest("Competition", DateTime.UtcNow, "Expulsión", "Updated", "3 partidos", endDate))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse>();
            Assert.NotNull(body!.EndDate);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeletePlayerSanction_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeletePlayerSanction_WithCoachRole_DeletesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var sanctionId = await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions/{sanctionId}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_WithPlayerRole_ReturnsOk()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_FilterByCategory_ReturnsOnlyMatchingCategory()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            await CreateSanctionAsync(teamPlayerId, SanctionCategory.Competition);
            await CreateSanctionAsync(teamPlayerId, SanctionCategory.InternalDiscipline);
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions?category=Competition");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerSanction.SanctionRecordResponse[]>();
            Assert.NotNull(body);
            Assert.All(body!, r => Assert.Equal("Competition", r.Category));
            Assert.Single(body!);
        }

        [Fact]
        public async Task GetPlayerSanctions_WithUnknownCategoryFilter_ReturnsBadRequest()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/sanctions?category=NotACategory");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerSanctions_ForNonExistentTeamPlayer_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new SetPlayerSanction());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/catalog/teamplayer/does-not-exist/sanctions");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }
}
