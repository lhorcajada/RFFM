#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
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
    /// Regression tests for a security bug: POST /api/catalog/teamplayer/{id}/ratings/conceptual
    /// and POST /api/catalog/teamplayer/{id}/ratings (CreateConceptualRating, CreateTeamPlayerRating)
    /// had no authorization configured at all, so any caller -- authenticated or not, any role --
    /// could persist a player rating. These endpoints are inline Minimal API delegates (not
    /// Mediator ICommand/IQueryApp), so they cannot use IRequireFeaturePermission /
    /// FeaturePermissionBehavior; the fix follows the same [Authorize(Roles = "...")] pattern
    /// already used on other non-Mediator endpoints (see e.g. SeasonAccess and Convocations
    /// features), restricting access to Coach and Administrator only.
    ///
    /// Runs against a real Postgres instance (Testcontainers) because TeamPlayerRating has a
    /// foreign key to TeamPlayer that Postgres enforces (unlike EF Core's InMemory provider).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class RatingEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public RatingEndpointAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        /// <summary>
        /// Authentication handler for tests: always authenticates, assigning whatever role is
        /// passed via the "X-Test-Role" request header as a ClaimTypes.Role claim. This lets each
        /// test simulate a different caller role without standing up the full JWT pipeline.
        /// </summary>
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

            var club = Club.Create($"Rating Auth Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Rating Auth Test Team",
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

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreateConceptualRating_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var (host, client) = await StartHostAsync(new CreateConceptualRating());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/catalog/teamplayer/some-team-player/ratings/conceptual")
            {
                Content = JsonContent.Create(new CreateConceptualRating.CreateConceptualRatingRequest(
                    false,
                    new List<CreateConceptualRating.CharacteristicAnswerRequest>
                    {
                        new("dribbling", "technical", 7, "Bueno"),
                    },
                    null))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreateConceptualRating_WithCoachRole_SavesRatingSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateConceptualRating());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/ratings/conceptual")
            {
                Content = JsonContent.Create(new CreateConceptualRating.CreateConceptualRatingRequest(
                    false,
                    new List<CreateConceptualRating.CharacteristicAnswerRequest>
                    {
                        new("dribbling", "technical", 7, "Bueno"),
                    },
                    null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreateTeamPlayerRating_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var (host, client) = await StartHostAsync(new CreateTeamPlayerRating());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/catalog/teamplayer/some-team-player/ratings")
            {
                Content = JsonContent.Create(ValidLegacyRatingRequest())
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreateTeamPlayerRating_WithCoachRole_SavesRatingSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateTeamPlayerRating());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/ratings")
            {
                Content = JsonContent.Create(ValidLegacyRatingRequest())
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task UpdateTeamPlayer_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, "/api/catalog/teamplayer/some-team-player")
            {
                Content = JsonContent.Create(new UpdateTeamPlayer.UpdateRequest(
                    null,
                    new UpdateTeamPlayer.PlayerInfoRequest("New Name", null, null, null),
                    null,
                    null,
                    null,
                    null))
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdateTeamPlayer_WithCoachRole_UpdatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new UpdateTeamPlayer());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/catalog/teamplayer/{teamPlayerId}")
            {
                Content = JsonContent.Create(new UpdateTeamPlayer.UpdateRequest(
                    null,
                    new UpdateTeamPlayer.PlayerInfoRequest("Updated Name", null, null, null),
                    null,
                    null,
                    null,
                    null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        private static CreateTeamPlayerRating.CreateRatingRequest ValidLegacyRatingRequest() =>
            new(
                PhysicalSpeed: 60,
                PhysicalEndurance: 60,
                PhysicalStrength: 60,
                TechnicalDribbling: 60,
                TechnicalPassing: 60,
                TechnicalControl: 60,
                TechnicalShooting: 60,
                TechnicalTackling: 60,
                TechnicalInterceptions: 60,
                TechnicalHeading: 60,
                TacticalDefensiveAwareness: 60,
                TacticalMarking: 60,
                TacticalTrackBack: 60,
                TacticalPressing: 60,
                TacticalGeneratesAdvantage: 60,
                TacticalOffMovement: 60,
                TacticalBeatsOpponents: 60,
                TacticalAttackParticipation: 60,
                CompetDuelWinning: 60,
                CompetLooseBalls: 60,
                CompetRecoveries: 60,
                CompetDecisiveActions: 60,
                CompetResponsibility: 60,
                CompetConstantEffort: 60,
                Notes: null);
    }
}
