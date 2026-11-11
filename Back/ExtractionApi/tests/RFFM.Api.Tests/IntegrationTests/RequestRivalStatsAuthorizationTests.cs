#nullable enable
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.MatchForecast;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// POST api/teams/{teamId}/match-forecast/requests accepts only the Coach role. The endpoint checks the
    /// roles before the mediator, so a rejected caller never reaches the command.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class RequestRivalStatsAuthorizationTests
    {
        private const string TeamId = "team-forecast-1";
        private const string Route = "/api/teams/" + TeamId + "/match-forecast/requests";

        private readonly PostgresContainerFixture _fixture;

        public RequestRivalStatsAuthorizationTests(PostgresContainerFixture fixture)
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
                if (Request.Headers.ContainsKey("X-Test-Anonymous"))
                {
                    return Task.FromResult(AuthenticateResult.NoResult());
                }

                var roles = Request.Headers.TryGetValue("X-Test-Role", out var values)
                    ? values.ToString()
                    : string.Empty;

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.Name, "test-user"),
                    new Claim(ClaimTypes.NameIdentifier, "test-user-id"),
                };
                foreach (var role in roles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    claims.Add(new Claim(ClaimTypes.Role, role));
                }

                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private static async Task<(IHost Host, HttpClient Client, List<IRequest<RivalStatsStatusResponse>> Sent)> StartHostAsync(
            RivalStatsStatusResponse response)
        {
            var sent = new List<IRequest<RivalStatsStatusResponse>>();
            var mediator = new Mock<IMediator>();
            mediator
                .Setup(m => m.Send(It.IsAny<IRequest<RivalStatsStatusResponse>>(), It.IsAny<CancellationToken>()))
                .Callback<IRequest<RivalStatsStatusResponse>, CancellationToken>((request, _) => sent.Add(request))
                .Returns(new ValueTask<RivalStatsStatusResponse>(response));

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
                            services.AddSingleton<IMediator>(mediator.Object);
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new RequestRivalStats().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), sent);
        }

        private static RivalStatsStatusResponse PendingReport() => new(
            LeagueSquadStatsStatus.Pending.Name, 0, 0, 0, null, null, null);

        private static HttpRequestMessage PostRequest(string? role)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, Route)
            {
                Content = JsonContent.Create(new { Refresh = false })
            };
            if (role is not null)
            {
                request.Headers.Add("X-Test-Role", role);
            }

            return request;
        }

        [Theory]
        [InlineData("Player")]
        [InlineData("FamilyMember")]
        public async Task RequestForecast_WithNonCoachRole_ReturnsForbiddenProblemWithoutCallingMediator(string role)
        {
            var (host, client, sent) = await StartHostAsync(PendingReport());
            using var _ = host;

            var response = await client.SendAsync(PostRequest(role));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal(403, problem.RootElement.GetProperty("status").GetInt32());
            Assert.Equal("Solo un entrenador puede generar o actualizar el pronóstico de partidos",
                problem.RootElement.GetProperty("title").GetString());
            Assert.Equal(ErrorCodes.MatchForecastRequestForbidden, problem.RootElement.GetProperty("code").GetString());
            Assert.Empty(sent);
        }

        [Fact]
        public async Task RequestForecast_WithAdministratorWithoutCoachRole_ReturnsForbiddenWithoutCallingMediator()
        {
            var (host, client, sent) = await StartHostAsync(PendingReport());
            using var _ = host;

            var response = await client.SendAsync(PostRequest("Administrator"));

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Empty(sent);
        }

        [Fact]
        public async Task RequestForecast_WithCoachRole_SendsOneCommandForTheRouteTeam()
        {
            var (host, client, sent) = await StartHostAsync(PendingReport());
            using var _ = host;

            var response = await client.SendAsync(PostRequest("Coach"));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            var command = Assert.IsType<RequestRivalStats.RequestRivalStatsCommand>(Assert.Single(sent));
            Assert.Equal(TeamId, command.TeamId);
        }

        [Fact]
        public async Task RequestForecast_WithCoachAndAdministratorRoles_SendsOneCommand()
        {
            var (host, client, sent) = await StartHostAsync(PendingReport());
            using var _ = host;

            var response = await client.SendAsync(PostRequest("Administrator,Coach"));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Single(sent);
        }

        [Fact]
        public async Task RequestForecast_WithAnonymousCaller_ReturnsUnauthorizedWithoutCallingMediator()
        {
            var (host, client, sent) = await StartHostAsync(PendingReport());
            using var _ = host;

            var request = PostRequest(role: null);
            request.Headers.Add("X-Test-Anonymous", "true");

            var response = await client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Empty(sent);
        }
    }
}
