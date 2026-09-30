#nullable enable
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RFFM.Api.Features.Infrastructure;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    public class GetApiVersionTests
    {
        [Fact]
        public async Task GetApiVersion_ReturnsAssemblyVersionAnonymously()
        {
            using var host = await StartHostAsync();
            var client = host.GetTestClient();

            var response = await client.GetAsync("/api/version");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<GetApiVersion.ApiVersionDto>();
            Assert.Equal("1.0.0", body?.Version);
        }

        [Theory]
        [InlineData("1.2.3+9be4c624abcdef0123456789", "1.2.3", "9be4c62")]
        [InlineData("1.2.3+abc", "1.2.3", "abc")]
        [InlineData("1.2.3", "1.2.3", null)]
        public void Parse_SplitsSemVerAndShortCommit(string informational, string expectedVersion, string? expectedCommit)
        {
            var dto = GetApiVersion.Parse(informational);

            Assert.Equal(new GetApiVersion.ApiVersionDto(expectedVersion, expectedCommit), dto);
        }

        private static async Task<IHost> StartHostAsync()
        {
            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services => services.AddRouting())
                        .Configure(app =>
                        {
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new GetApiVersion().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return host;
        }
    }
}
