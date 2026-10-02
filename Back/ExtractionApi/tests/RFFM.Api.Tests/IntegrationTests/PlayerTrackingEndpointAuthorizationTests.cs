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
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.PlayerTracking;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// El seguimiento del modelo de juego es solo para el rol Coach: el permiso de feature GameModel
    /// también lo tienen Player (lectura), ClubDirector y ClubMember, así que no basta por sí solo.
    /// Mismo arranque de host que <see cref="TeamNotesEndpointAuthorizationTests"/>.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class PlayerTrackingEndpointAuthorizationTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PlayerTrackingEndpointAuthorizationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var role = Request.Headers.TryGetValue("X-Test-Role", out var values) ? values.ToString() : string.Empty;
                var claims = new System.Collections.Generic.List<Claim> { new(ClaimTypes.Name, "test-user") };
                if (!string.IsNullOrEmpty(role))
                    claims.Add(new Claim(ClaimTypes.Role, role));

                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
                return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
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
                                options.UseNpgsql(_fixture.ConnectionString, npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app")));
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

        private static readonly string[] NonCoachRoles = { "Player", "FamilyMember", "ClubDirector", "ClubMember", "Administrator" };

        public static TheoryData<string, string> NonCoachRequests()
        {
            var data = new TheoryData<string, string>();
            foreach (var role in NonCoachRoles)
            {
                data.Add(role, "GET");
                data.Add(role, "POST");
                data.Add(role, "PUT");
                data.Add(role, "DELETE");
                data.Add(role, "SESSION-PUT");
                data.Add(role, "SESSION-GET");
                data.Add(role, "SESSION-DELETE");
            }
            return data;
        }

        private static (IFeatureModule Module, HttpRequestMessage Request) BuildRequest(string method, string teamId, string teamPlayerId)
        {
            var url = $"/api/teams/{teamId}/players/{teamPlayerId}/observations";
            var sessionUrl = $"/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations";
            return method switch
            {
                "GET" => (new GetPlayerObservations(), new HttpRequestMessage(HttpMethod.Get, url)),
                "POST" => (new CreatePlayerObservation(), new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = JsonContent.Create(new { date = "2026-09-14", subprincipioId = "sub-1", assessment = "Partial" })
                }),
                "PUT" => (new UpdatePlayerObservation(), new HttpRequestMessage(HttpMethod.Put, $"{url}/obs-1")
                {
                    Content = JsonContent.Create(new { assessment = "Partial" })
                }),
                "DELETE" => (new DeletePlayerObservation(), new HttpRequestMessage(HttpMethod.Delete, $"{url}/obs-1")),
                "SESSION-PUT" => (new SaveSessionEvaluation(), new HttpRequestMessage(HttpMethod.Put, $"{sessionUrl}/ses-1")
                {
                    Content = JsonContent.Create(new { evaluations = new[] { new { subprincipioId = "sub-1", assessment = "Partial" } } })
                }),
                "SESSION-GET" => (new GetSessionEvaluation(), new HttpRequestMessage(HttpMethod.Get, $"{sessionUrl}/ses-1")),
                _ => (new DeleteSessionEvaluation(), new HttpRequestMessage(HttpMethod.Delete, $"{sessionUrl}/ses-1")),
            };
        }

        [Theory]
        [MemberData(nameof(NonCoachRequests))]
        public async Task Observations_WithNonCoachRole_ReturnForbidden(string role, string method)
        {
            var (module, request) = BuildRequest(method, "team-1", "tp-1");
            var (host, client) = await StartHostAsync(module);
            using var _ = host;
            request.Headers.Add("X-Test-Role", role);

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task ListObservations_WithCoachRole_IsAllowed()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, _) = await PlayerModelObservationPersistenceTests.SeedAsync(db);
            var (module, request) = BuildRequest("GET", teamId, teamPlayerId);
            var (host, client) = await StartHostAsync(module);
            using var _ = host;
            request.Headers.Add("X-Test-Role", "Coach");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
