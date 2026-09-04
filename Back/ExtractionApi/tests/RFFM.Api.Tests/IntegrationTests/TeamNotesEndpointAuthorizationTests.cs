#nullable enable
using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Mediator;
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
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Notes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Coverage for the write endpoints of Features/Coaches/Notes: role-gated writes
    /// (Coach only, per explicit acceptance criteria — narrower than the
    /// Administrator,Coach pattern used elsewhere). Mirrors
    /// SanctionEndpointAuthorizationTests's host bootstrap exactly. GET's read-authorization
    /// (IRequireFeaturePermission/IRequireTeamMembership, enforced by Mediator pipeline
    /// behaviors rather than [Authorize]) is covered separately at the handler level
    /// (GetTeamNotesHandlerTests) and by the existing FeaturePermissionBehaviorTests/
    /// TeamMembershipBehaviorTests, which already exercise the same behaviors
    /// GetEventConvocations relies on.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class TeamNotesEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public TeamNotesEndpointAuthorizationTests(PostgresContainerFixture fixture)
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

                var claims = new System.Collections.Generic.List<Claim>
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
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
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

        private async Task<string> SeedTeamAsync()
        {
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create($"Notes Auth Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Notes Auth Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            return team.Id;
        }

        private async Task<string> SeedNoteAsync(string teamId)
        {
            await using var setupDb = _fixture.CreateDbContext();
            var note = TeamNote.Create(teamId, "Nota de prueba", 1);
            setupDb.TeamNotes.Add(note);
            await setupDb.SaveChangesAsync();
            return note.Id;
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        [InlineData("ClubDirector")]
        [InlineData("Administrator")]
        public async Task CreateNote_WithNonCoachRole_ReturnsForbidden(string role)
        {
            var teamId = await SeedTeamAsync();
            var (host, client) = await StartHostAsync(new CreateTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/teams/{teamId}/notes")
            {
                Content = JsonContent.Create(new { Text = "Nueva nota" })
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CreateNote_WithCoachRole_CreatesSuccessfully()
        {
            var teamId = await SeedTeamAsync();
            var (host, client) = await StartHostAsync(new CreateTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Post, $"/api/teams/{teamId}/notes")
            {
                Content = JsonContent.Create(new { Text = "Nueva nota" })
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("Administrator")]
        public async Task UpdateNote_WithNonCoachRole_ReturnsForbidden(string role)
        {
            var teamId = await SeedTeamAsync();
            var noteId = await SeedNoteAsync(teamId);
            var (host, client) = await StartHostAsync(new UpdateTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/teams/{teamId}/notes/{noteId}")
            {
                Content = JsonContent.Create(new { Text = "Texto actualizado" })
            };
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task UpdateNote_WithCoachRole_UpdatesSuccessfully()
        {
            var teamId = await SeedTeamAsync();
            var noteId = await SeedNoteAsync(teamId);
            var (host, client) = await StartHostAsync(new UpdateTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Put, $"/api/teams/{teamId}/notes/{noteId}")
            {
                Content = JsonContent.Create(new { Text = "Texto actualizado" })
            };
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("Administrator")]
        public async Task DeleteNote_WithNonCoachRole_ReturnsForbidden(string role)
        {
            var teamId = await SeedTeamAsync();
            var noteId = await SeedNoteAsync(teamId);
            var (host, client) = await StartHostAsync(new DeleteTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/teams/{teamId}/notes/{noteId}");
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task DeleteNote_WithCoachRole_DeletesSuccessfully()
        {
            var teamId = await SeedTeamAsync();
            var noteId = await SeedNoteAsync(teamId);
            var (host, client) = await StartHostAsync(new DeleteTeamNote());
            using var _ = host;

            var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/teams/{teamId}/notes/{noteId}");
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }
    }
}
