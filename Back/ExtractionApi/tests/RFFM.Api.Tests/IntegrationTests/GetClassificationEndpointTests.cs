#nullable enable
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Queries;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    public class GetClassificationEndpointTests
    {
        private static async Task<(IHost Host, HttpClient Client, Mock<IRffmResultsSyncService> Service)> StartHostAsync()
        {
            var service = new Mock<IRffmResultsSyncService>();
            service.Setup(s => s.GetClassificationAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ClassificationResponse { Teams = [new TeamResponse { TeamId = "1598", Position = "1" }] });

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder => webBuilder
                    .UseTestServer()
                    .ConfigureServices(services =>
                    {
                        services.AddRouting();
                        services.AddSingleton(service.Object);
                        services.Configure<RffmOptions>(o => o.CurrentSeasonId = 22);
                        services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                    })
                    .Configure(app =>
                    {
                        app.UseRouting();
                        app.UseEndpoints(endpoints => new FederationGetClassification().AddRoutes(endpoints));
                    }))
                .Build();

            await host.StartAsync();
            return (host, host.GetTestClient(), service);
        }

        [Fact]
        public async Task Devuelve_la_clasificacion_guardada_del_grupo()
        {
            var (host, client, service) = await StartHostAsync();
            using var _ = host;

            var response = await client.GetFromJsonAsync<ClassificationResponse>("/classification?season=21&competition=1&group=26738048");

            Assert.Equal("1598", Assert.Single(response!.Teams).TeamId);
            service.Verify(s => s.GetClassificationAsync(26738048, 21, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Sin_temporada_usa_la_temporada_actual()
        {
            var (host, client, service) = await StartHostAsync();
            using var _ = host;

            var response = await client.GetAsync("/classification?competition=1&group=26738048");

            response.EnsureSuccessStatusCode();
            service.Verify(s => s.GetClassificationAsync(26738048, 22, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
