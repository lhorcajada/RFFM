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
    /// Regression tests for the bulk team-injuries endpoint added to stop Injured.tsx from issuing
    /// one GET /api/catalog/teamplayer/{id}/injuries call per roster player. This endpoint returns
    /// every team player's injuries for a team in a single response.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetTeamInjuriesEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamInjuriesEndpointTests(PostgresContainerFixture fixture)
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

        private async Task<(string TeamId, string TeamPlayerId)> CreateTeamPlayerAsync(string? teamId = null)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Team Injuries Test Club {Guid.NewGuid():N}", 1);
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

            Team team;
            if (teamId != null)
            {
                team = await setupDb.Teams.FirstAsync(t => t.Id == teamId);
            }
            else
            {
                team = new Team(new TeamModelBase
                {
                    Name = "Team Injuries Test Team",
                    CategoryId = Category.NationalCategory.Id,
                    ClubId = club.Id,
                    SeasonId = season.Id
                });
                setupDb.Teams.Add(team);
                await setupDb.SaveChangesAsync();
            }

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

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> CreateInjuryAsync(string teamPlayerId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var injury = TeamPlayerInjury.Create(teamPlayerId, DateTime.UtcNow, "Muscular", "Test injury", "2 weeks");
            setupDb.TeamPlayerInjuries.Add(injury);
            await setupDb.SaveChangesAsync();

            return injury.Id;
        }

        [Fact]
        public async Task GetTeamInjuries_ReturnsInjuriesForEveryTeamPlayer_InOneCall()
        {
            var (teamId, teamPlayerId1) = await CreateTeamPlayerAsync();
            var (_, teamPlayerId2) = await CreateTeamPlayerAsync(teamId);
            await CreateInjuryAsync(teamPlayerId1);
            await CreateInjuryAsync(teamPlayerId2);

            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injuries");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerInjury.TeamPlayerInjuriesResponse[]>();
            Assert.NotNull(body);
            Assert.Equal(2, body!.Length);
            Assert.Contains(body, r => r.TeamPlayerId == teamPlayerId1 && r.Injuries.Length == 1);
            Assert.Contains(body, r => r.TeamPlayerId == teamPlayerId2 && r.Injuries.Length == 1);
        }

        [Fact]
        public async Task GetTeamInjuries_OmitsTeamPlayersWithNoInjuries()
        {
            var (teamId, teamPlayerId1) = await CreateTeamPlayerAsync();
            await CreateTeamPlayerAsync(teamId);
            await CreateInjuryAsync(teamPlayerId1);

            var (host, client) = await StartHostAsync(new SetPlayerInjury());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/injuries");
            request.Headers.Add("X-Test-Role", "Player");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<SetPlayerInjury.TeamPlayerInjuriesResponse[]>();
            Assert.NotNull(body);
            Assert.Single(body!);
            Assert.Equal(teamPlayerId1, body![0].TeamPlayerId);
        }
    }
}
