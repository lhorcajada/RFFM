#nullable enable
using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// GetActa ("/acta/{codActa}") used to default "temporada" to the hardcoded literal 21.
    /// This regression suite asserts the endpoint now resolves the configured
    /// RffmOptions.CurrentSeasonId when the caller omits "temporada", while still honoring an
    /// explicit "temporada" query value when provided.
    /// </summary>
    public class GetActaSeasonTests
    {
        private async Task<(IHost Host, HttpClient Client, Mock<IActaService> ActaServiceMock)> StartHostAsync(int currentSeasonId)
        {
            var actaServiceMock = new Mock<IActaService>();
            actaServiceMock
                .Setup(s => s.GetMatchFromActaAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm());

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddSingleton(actaServiceMock.Object);
                            services.Configure<RffmOptions>(o => o.CurrentSeasonId = currentSeasonId);
                        })
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new FederationGetActa().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), actaServiceMock);
        }

        [Fact]
        public async Task GetActa_WithoutExplicitTemporada_UsesConfiguredCurrentSeasonId()
        {
            var (host, client, actaServiceMock) = await StartHostAsync(currentSeasonId: 22);
            using var _ = host;

            var response = await client.GetAsync("/acta/5440937");
            response.EnsureSuccessStatusCode();

            actaServiceMock.Verify(s => s.GetMatchFromActaAsync("5440937", 22, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetActa_WithExplicitTemporada_OverridesConfiguredCurrentSeasonId()
        {
            var (host, client, actaServiceMock) = await StartHostAsync(currentSeasonId: 22);
            using var _ = host;

            var response = await client.GetAsync("/acta/5440937?temporada=20");
            response.EnsureSuccessStatusCode();

            actaServiceMock.Verify(s => s.GetMatchFromActaAsync("5440937", 20, It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
