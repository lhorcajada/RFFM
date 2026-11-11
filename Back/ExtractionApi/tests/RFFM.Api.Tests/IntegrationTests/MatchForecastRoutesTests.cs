#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.MatchForecast;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// The rival statistics feature is served under api/teams/{teamId}/match-forecast. The former
    /// rival-stats prefix no longer exists and answers 404 without a redirect.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class MatchForecastRoutesTests
    {
        private const string TeamId = "team-forecast-routes";

        private readonly PostgresContainerFixture _fixture;

        public MatchForecastRoutesTests(PostgresContainerFixture fixture)
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
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                    new Claim(ClaimTypes.NameIdentifier, "test-user-id"),
                    new Claim(ClaimTypes.Role, "Coach"),
                };

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client)> StartHostAsync()
        {
            var modules = new IFeatureModule[]
            {
                new GetRivalStats(),
                new GetRivalTeamStats(),
                new RequestRivalStats(),
                new GetRivalSimulation(),
                new GetRivalSimulationHistory(),
                new SyncRivalSimulationRounds(),
            };

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
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        })
                        .Configure(app =>
                        {
                            // Only routing is under test: an endpoint reached without its services answers 500, not 404.
                            app.Use(async (context, next) =>
                            {
                                try
                                {
                                    await next(context);
                                }
                                catch (Exception)
                                {
                                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                                }
                            });
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints =>
                            {
                                foreach (var module in modules)
                                {
                                    module.AddRoutes(endpoints);
                                }
                            });
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient());
        }

        [Theory]
        [InlineData("GET", "/api/teams/{0}/match-forecast")]
        [InlineData("GET", "/api/teams/{0}/match-forecast/simulation")]
        [InlineData("GET", "/api/teams/{0}/match-forecast/simulation/rounds")]
        [InlineData("PUT", "/api/teams/{0}/match-forecast/simulation/rounds")]
        [InlineData("GET", "/api/teams/{0}/match-forecast/teams/E1")]
        public async Task MatchForecastRoute_IsRouted(string method, string pathTemplate)
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(new HttpMethod(method), string.Format(pathTemplate, TeamId));

            var response = await client.SendAsync(request);

            Assert.NotEqual(HttpStatusCode.NotFound, response.StatusCode);
            Assert.NotEqual(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        }

        [Theory]
        [InlineData("GET", "/api/teams/{0}/rival-stats")]
        [InlineData("GET", "/api/teams/{0}/rival-stats/simulation")]
        [InlineData("GET", "/api/teams/{0}/rival-stats/simulation/rounds")]
        [InlineData("PUT", "/api/teams/{0}/rival-stats/simulation/rounds")]
        [InlineData("GET", "/api/teams/{0}/rival-stats/teams/E1")]
        public async Task RivalStatsRoute_IsNoLongerServed(string method, string pathTemplate)
        {
            var (host, client) = await StartHostAsync();
            using var _ = host;

            var request = new HttpRequestMessage(new HttpMethod(method), string.Format(pathTemplate, TeamId));

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Null(response.Headers.Location);
        }
    }
}
