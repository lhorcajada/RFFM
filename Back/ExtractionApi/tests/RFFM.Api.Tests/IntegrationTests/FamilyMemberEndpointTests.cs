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
using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for CreateFamilyMember/DeleteFamilyMember (openspec change
    /// player-family-members-crud): role-gated writes (Coach/Administrator only), validation of
    /// the create request, and 404s for unknown team players/family members. Unlike
    /// SetPlayerSanction/SetPlayerInjury (inline Minimal API handlers), these two features use
    /// the standard Mediator vertical slice (ICommand/Handler/Validator), so the test host needs
    /// the full pipeline wired -- mirrors NewsEndpointAuthorizationTests's host bootstrap.
    /// Runs against a real Postgres instance (Testcontainers) because TeamPlayerFamilyMember has
    /// a foreign key to TeamPlayer that Postgres enforces (unlike EF Core's InMemory provider).
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class FamilyMemberEndpointTests
    {
        private readonly PostgresContainerFixture _fixture;

        public FamilyMemberEndpointTests(PostgresContainerFixture fixture)
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
                            services.AddControllers();
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
                            services.AddHttpContextAccessor();
                            services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
                            services.AddScoped<ICurrentUserService, CurrentUserService>();

                            services.AddCustomProblemDetails()
                                .AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });

                            services
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TimeLoggingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(FeaturePermissionBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(TeamMembershipBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(CachingBehavior<,>))
                                .AddTransient(typeof(IPipelineBehavior<,>), typeof(InvalidateCachingBehavior<,>));

                            services.AddEasyCaching(options => { options.UseInMemory(Cache.CacheDefaultName); });

                            services.AddScoped<IValidator<CreateFamilyMember.CreateFamilyMemberCommand>, CreateFamilyMember.Validator>();
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
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

            var club = Club.Create($"FamilyMember Test Club {Guid.NewGuid():N}", 1);
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
                Name = "FamilyMember Test Team",
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

        private async Task<string> CreateFamilyMemberAsync(string teamPlayerId)
        {
            await using var setupDb = _fixture.CreateDbContext();

            var familyMember = TeamPlayerFamilyMember.Create(teamPlayerId, "Jane", "Doe", "600123456", "jane@rffm.test", "12345678A", "Mother");
            setupDb.TeamPlayerFamilyMembers.Add(familyMember);
            await setupDb.SaveChangesAsync();

            return familyMember.Id;
        }

        private static CreateFamilyMember.CreateFamilyMemberRequest ValidRequest(int familyMemberId = 1) =>
            new("Jane", "Doe", familyMemberId, "600123456", "jane@rffm.test", "12345678A");

        // ── POST /api/catalog/teamplayer/{id}/family-members ──────────────────────

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task CreateFamilyMember_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/family-members")
            {
                Content = JsonContent.Create(ValidRequest())
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreateFamilyMember_WithCoachRoleAndValidData_CreatesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/family-members")
            {
                Content = JsonContent.Create(ValidRequest())
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<CreateFamilyMember.FamilyMemberResponse>();
            Assert.NotNull(body);
            Assert.False(string.IsNullOrWhiteSpace(body!.Id));
            Assert.Equal("Jane", body.Name);
            Assert.Equal("Doe", body.LastName);
            Assert.Equal("Mother", body.FamilyMember);
            Assert.Equal("12345678A", body.Dni);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.TeamPlayerFamilyMembers.SingleAsync(f => f.Id == body.Id);
            Assert.Equal(teamPlayerId, persisted.TeamPlayerId);
        }

        [Theory]
        [InlineData(3)] // LegalGuardian
        [InlineData(4)] // Other
        public async Task CreateFamilyMember_WithNonParentalRelation_CreatesSuccessfully(int familyMemberId)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/family-members")
            {
                Content = JsonContent.Create(ValidRequest(familyMemberId))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        [Theory]
        [InlineData(null, "Doe", 1, "jane@rffm.test", "600123456")]
        [InlineData("Jane", null, 1, "jane@rffm.test", "600123456")]
        [InlineData("Jane", "Doe", 1, "not-an-email", "600123456")]
        [InlineData("Jane", "Doe", 1, "jane@rffm.test", "abc")]
        [InlineData("Jane", "Doe", 99, "jane@rffm.test", "600123456")]
        public async Task CreateFamilyMember_WithInvalidData_ReturnsBadRequest(
            string? name, string? lastName, int familyMemberId, string? email, string? phone)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new CreateFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/catalog/teamplayer/{teamPlayerId}/family-members")
            {
                Content = JsonContent.Create(new CreateFamilyMember.CreateFamilyMemberRequest(name, lastName, familyMemberId, phone, email, null))
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateFamilyMember_ForNonExistentTeamPlayer_ReturnsNotFound()
        {
            var (host, client) = await StartHostAsync(new CreateFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, "/api/catalog/teamplayer/does-not-exist/family-members")
            {
                Content = JsonContent.Create(ValidRequest())
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ── DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId} ───

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task DeleteFamilyMember_WithDisallowedRole_ReturnsForbidden(string role)
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var familyMemberId = await CreateFamilyMemberAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new DeleteFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/family-members/{familyMemberId}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeleteFamilyMember_WithCoachRole_DeletesSuccessfully()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var familyMemberId = await CreateFamilyMemberAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new DeleteFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/family-members/{familyMemberId}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            await using var verifyDb = _fixture.CreateDbContext();
            var stillExists = await verifyDb.TeamPlayerFamilyMembers.AnyAsync(f => f.Id == familyMemberId);
            Assert.False(stillExists);
        }

        [Fact]
        public async Task DeleteFamilyMember_LeavesOtherFamilyMembersOfSameTeamPlayerIntact()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var toDelete = await CreateFamilyMemberAsync(teamPlayerId);
            var toKeep = await CreateFamilyMemberAsync(teamPlayerId);
            var (host, client) = await StartHostAsync(new DeleteFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/family-members/{toDelete}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            await using var verifyDb = _fixture.CreateDbContext();
            var kept = await verifyDb.TeamPlayerFamilyMembers.SingleOrDefaultAsync(f => f.Id == toKeep);
            Assert.NotNull(kept);
        }

        [Fact]
        public async Task DeleteFamilyMember_ForNonExistentFamilyMember_ReturnsNotFound()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var (host, client) = await StartHostAsync(new DeleteFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/family-members/does-not-exist");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task DeleteFamilyMember_BelongingToAnotherTeamPlayer_ReturnsNotFound()
        {
            var teamPlayerId = await CreateTeamPlayerAsync();
            var otherTeamPlayerId = await CreateTeamPlayerAsync();
            var familyMemberOfOther = await CreateFamilyMemberAsync(otherTeamPlayerId);
            var (host, client) = await StartHostAsync(new DeleteFamilyMember());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/catalog/teamplayer/{teamPlayerId}/family-members/{familyMemberOfOther}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

            await using var verifyDb = _fixture.CreateDbContext();
            var stillExists = await verifyDb.TeamPlayerFamilyMembers.AnyAsync(f => f.Id == familyMemberOfOther);
            Assert.True(stillExists);
        }
    }
}
