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
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression tests for a data-leak bug: GET /api/catalog/team/{teamId}/ratings/latest and
    /// GET /api/catalog/teamplayer/{id}/ratings had no authorization at all, so a Player or
    /// FamilyMember caller received ratings for every player on the team instead of only their
    /// own linked player. The frontend (Squad.tsx) already hides the other players' cards, but
    /// the API itself leaked the data. Fix mirrors ConfirmAttendance's ICurrentUserService +
    /// UserTeam.LinkedTeamPlayerId ownership check.
    ///
    /// Runs against a real Postgres instance (Testcontainers) because TeamPlayerRating has a
    /// foreign key to TeamPlayer that Postgres enforces (unlike EF Core's InMemory provider).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class RatingOwnershipFilterTests
    {
        private readonly PostgresContainerFixture _fixture;

        public RatingOwnershipFilterTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        /// <summary>
        /// Authentication handler for tests: always authenticates, assigning the role passed via
        /// the "X-Test-Role" header as a ClaimTypes.Role claim, and the user id passed via the
        /// "X-Test-User-Id" header as a nameidentifier claim (the claim type CurrentUserService
        /// reads for ICurrentUserService.UserId).
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
                var role = Request.Headers.TryGetValue("X-Test-Role", out var roleValues)
                    ? roleValues.ToString()
                    : string.Empty;
                var userId = Request.Headers.TryGetValue("X-Test-User-Id", out var userIdValues)
                    ? userIdValues.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                };
                if (!string.IsNullOrEmpty(role))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }
                if (!string.IsNullOrEmpty(userId))
                {
                    claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
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
                            services.AddHttpContextAccessor();
                            services.AddScoped<ICurrentUserService, CurrentUserService>();
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

        private async Task<string> CreateTeamPlayerAsync(string teamId, string seasonId, string clubId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            setupDb.Players.Add(player);
            await setupDb.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            setupDb.TeamPlayers.Add(teamPlayer);
            await setupDb.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task<(string TeamId, string SeasonId, string ClubId)> CreateTeamAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Rating Ownership Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Rating Ownership Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            return (team.Id, season.Id, club.Id);
        }

        private async Task CreateRatingAsync(string teamPlayerId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var rating = TeamPlayerRating.CreateConceptual(
                teamPlayerId,
                isGoalkeeper: false,
                new List<(string CharacteristicKey, string CategoryKey, int Level, string Concept)>
                {
                    ("dribbling", "technical", 7, "Bueno"),
                }.AsReadOnly(),
                notes: null,
                ratedAt: null);

            setupDb.TeamPlayerRatings.Add(rating);
            await setupDb.SaveChangesAsync();
        }

        private async Task LinkUserToTeamPlayerAsync(string userId, string teamId, string teamPlayerId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            userTeam.LinkPlayer(teamPlayerId);
            setupDb.Set<UserTeam>().Add(userTeam);
            await setupDb.SaveChangesAsync();
        }

        [Fact]
        public async Task GetTeamLatestRatings_WithLinkedPlayerRole_OnlyReturnsOwnRating()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var ownTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            var otherTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(ownTeamPlayerId);
            await CreateRatingAsync(otherTeamPlayerId);

            const string userId = "player-user-1";
            await LinkUserToTeamPlayerAsync(userId, teamId, ownTeamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamLatestRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/ratings/latest");
            request.Headers.Add("X-Test-Role", "Player");
            request.Headers.Add("X-Test-User-Id", userId);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamLatestRatings.TeamLatestRatingResponse>>();
            Assert.NotNull(body);
            Assert.Single(body!);
            Assert.Equal(ownTeamPlayerId, body![0].TeamPlayerId);
        }

        [Fact]
        public async Task GetTeamLatestRatings_WithFamilyMemberRole_OnlyReturnsLinkedPlayerRating()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var ownTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            var otherTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(ownTeamPlayerId);
            await CreateRatingAsync(otherTeamPlayerId);

            const string userId = "family-user-1";
            await LinkUserToTeamPlayerAsync(userId, teamId, ownTeamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamLatestRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/ratings/latest");
            request.Headers.Add("X-Test-Role", "FamilyMember");
            request.Headers.Add("X-Test-User-Id", userId);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamLatestRatings.TeamLatestRatingResponse>>();
            Assert.NotNull(body);
            Assert.Single(body!);
            Assert.Equal(ownTeamPlayerId, body![0].TeamPlayerId);
        }

        [Fact]
        public async Task GetTeamLatestRatings_WithUnlinkedPlayerRole_ReturnsEmptyList()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var teamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(teamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamLatestRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/ratings/latest");
            request.Headers.Add("X-Test-Role", "Player");
            request.Headers.Add("X-Test-User-Id", "unlinked-user");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamLatestRatings.TeamLatestRatingResponse>>();
            Assert.NotNull(body);
            Assert.Empty(body!);
        }

        [Fact]
        public async Task GetTeamLatestRatings_WithCoachRole_ReturnsAllTeamPlayerRatings()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var teamPlayerId1 = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            var teamPlayerId2 = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(teamPlayerId1);
            await CreateRatingAsync(teamPlayerId2);

            var (host, client) = await StartHostAsync(new GetTeamLatestRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/team/{teamId}/ratings/latest");
            request.Headers.Add("X-Test-Role", "Coach");
            request.Headers.Add("X-Test-User-Id", "coach-user-1");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamLatestRatings.TeamLatestRatingResponse>>();
            Assert.NotNull(body);
            Assert.Equal(2, body!.Count);
        }

        [Fact]
        public async Task GetTeamPlayerRatings_WithLinkedPlayerRole_ReturnsOwnRatings()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var ownTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(ownTeamPlayerId);

            const string userId = "player-user-2";
            await LinkUserToTeamPlayerAsync(userId, teamId, ownTeamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamPlayerRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{ownTeamPlayerId}/ratings");
            request.Headers.Add("X-Test-Role", "Player");
            request.Headers.Add("X-Test-User-Id", userId);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamPlayerRatings.TeamPlayerRatingResponse>>();
            Assert.NotNull(body);
            Assert.Single(body!);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task GetTeamPlayerRatings_WithRoleLinkedToDifferentPlayer_ReturnsForbidden(string role)
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var ownTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            var otherTeamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(otherTeamPlayerId);

            const string userId = "player-user-3";
            await LinkUserToTeamPlayerAsync(userId, teamId, ownTeamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamPlayerRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{otherTeamPlayerId}/ratings");
            request.Headers.Add("X-Test-Role", role);
            request.Headers.Add("X-Test-User-Id", userId);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task GetTeamPlayerRatings_WithUnlinkedPlayerRole_ReturnsForbidden()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var teamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(teamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamPlayerRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/ratings");
            request.Headers.Add("X-Test-Role", "Player");
            request.Headers.Add("X-Test-User-Id", "unlinked-user-2");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task GetTeamPlayerRatings_WithCoachRole_ReturnsRatingsForAnyPlayer()
        {
            var (teamId, seasonId, clubId) = await CreateTeamAsync();
            var teamPlayerId = await CreateTeamPlayerAsync(teamId, seasonId, clubId);
            await CreateRatingAsync(teamPlayerId);

            var (host, client) = await StartHostAsync(new GetTeamPlayerRatings());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Get, $"/api/catalog/teamplayer/{teamPlayerId}/ratings");
            request.Headers.Add("X-Test-Role", "Coach");
            request.Headers.Add("X-Test-User-Id", "coach-user-2");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<List<GetTeamPlayerRatings.TeamPlayerRatingResponse>>();
            Assert.NotNull(body);
            Assert.Single(body!);
        }

    }
}
