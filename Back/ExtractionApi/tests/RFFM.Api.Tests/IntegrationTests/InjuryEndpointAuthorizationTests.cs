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
    /// Regression tests for a security bug: POST/PUT/DELETE
    /// /api/catalog/teamplayer/{id}/injuries (SetPlayerInjury) had no role restriction, so any
    /// authenticated caller -- including Player and FamilyMember -- could create, update or delete
    /// a player's injury records. GET must remain open to every authenticated role, since
    /// "Lesionados" is one of the 8 read-only dashboard features allowed to Player.
    ///
    /// This endpoint is an inline Minimal API delegate (not Mediator ICommand/IQueryApp), so it
    /// cannot use IRequireFeaturePermission / FeaturePermissionBehavior; the fix follows the same
    /// [Authorize(Roles = "Coach,Administrator")] pattern already used on UpdateTeamPlayer,
    /// CreateConceptualRating and CreateTeamPlayerRating (see RatingEndpointAuthorizationTests).
    ///
    /// Runs against a real Postgres instance (Testcontainers) because TeamPlayerInjury has a
    /// foreign key to TeamPlayer that Postgres enforces (unlike EF Core's InMemory provider).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class InjuryEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public InjuryEndpointAuthorizationTests(PostgresContainerFixture fixture)
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

            var club = Club.Create($"Injury Auth Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Injury Auth Test Team",
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

        private async Task<string> CreateInjuryAsync(string teamPlayerId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var injury = TeamPlayerInjury.Create(teamPlayerId, DateTime.UtcNow, "Muscular", "Test injury", "2 weeks");
            setupDb.TeamPlayerInjuries.Add(injury);
            await setupDb.SaveChangesAsync();

            return injury.Id;
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreatePlayerInjury_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/injuries")
            {
                Content = JsonContent.Create(new SetPlayerInjury.InjuryCreateRequest(DateTime.UtcNow, "Muscular", "Test", "2 weeks"))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreatePlayerInjury_WithCoachRole_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/injuries")
            {
                Content = JsonContent.Create(new SetPlayerInjury.InjuryCreateRequest(DateTime.UtcNow, "Muscular", "Test", "2 weeks"))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdatePlayerInjury_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var injuryId = await CreateInjuryAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/injuries/{injuryId}")
            {
                Content = JsonContent.Create(new SetPlayerInjury.InjuryUpdateRequest(DateTime.UtcNow, "Muscular", "Updated", "3 weeks", null))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdatePlayerInjury_WithCoachRole_UpdatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var injuryId = await CreateInjuryAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}/injuries/{injuryId}")
            {
                Content = JsonContent.Create(new SetPlayerInjury.InjuryUpdateRequest(DateTime.UtcNow, "Muscular", "Updated", "3 weeks", null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeletePlayerInjury_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var injuryId = await CreateInjuryAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/injuries/{injuryId}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeletePlayerInjury_WithCoachRole_DeletesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var injuryId = await CreateInjuryAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/injuries/{injuryId}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task GetPlayerInjuries_WithPlayerRole_ReturnsOk()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/injuries");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
