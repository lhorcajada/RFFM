#nullable enable
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Encodings.Web;
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
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Queries;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// GetPlayer ("/players/{id}") used to default the "seasonId" query parameter to the
    /// hardcoded literal "21". This regression suite asserts the endpoint now resolves the
    /// configured RffmOptions.CurrentSeasonId when the caller omits "seasonId", while still
    /// honoring an explicit "seasonId" query value when provided.
    /// </summary>
    public class GetPlayerSeasonTests
    {
        private class AlwaysAuthenticatedHandler : AuthenticationHandler<AuthenticationSchemeOptions>
        {
            public const string SchemeName = "Test";

            public AlwaysAuthenticatedHandler(
                IOptionsMonitor<AuthenticationSchemeOptions> options,
                ILoggerFactory logger,
                UrlEncoder encoder)
                : base(options, logger, encoder)
            {
            }

            protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            {
                var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "test-user") };
                var identity = new ClaimsIdentity(claims, SchemeName);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, SchemeName);
                return Task.FromResult(AuthenticateResult.Success(ticket));
            }
        }

        private async Task<(IHost Host, HttpClient Client, Mock<IPlayerService> PlayerServiceMock)> StartHostAsync(int currentSeasonId)
        {
            var playerServiceMock = new Mock<IPlayerService>();
            playerServiceMock
                .Setup(s => s.GetPlayerAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Player { PlayerId = "P1" });

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddAuthentication(AlwaysAuthenticatedHandler.SchemeName)
                                .AddScheme<AuthenticationSchemeOptions, AlwaysAuthenticatedHandler>(AlwaysAuthenticatedHandler.SchemeName, _ => { });
                            services.AddAuthorization();
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                            services.AddScoped(_ => playerServiceMock.Object);
                            services.Configure<RffmOptions>(o => o.CurrentSeasonId = currentSeasonId);
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseAuthentication();
                            app.UseAuthorization();
                            app.UseEndpoints(endpoints => new FederationGetPlayer().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), playerServiceMock);
        }

        [Fact]
        public async Task GetPlayer_WithoutExplicitSeasonId_UsesConfiguredCurrentSeasonId()
        {
            var (host, client, playerServiceMock) = await StartHostAsync(currentSeasonId: 22);
            using var _ = host;

            var response = await client.GetAsync("/players/P1");
            response.EnsureSuccessStatusCode();

            playerServiceMock.Verify(s => s.GetPlayerAsync("P1", 22, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetPlayer_WithExplicitSeasonId_OverridesConfiguredCurrentSeasonId()
        {
            var (host, client, playerServiceMock) = await StartHostAsync(currentSeasonId: 22);
            using var _ = host;

            var response = await client.GetAsync("/players/P1?seasonId=20");
            response.EnsureSuccessStatusCode();

            playerServiceMock.Verify(s => s.GetPlayerAsync("P1", 20, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
