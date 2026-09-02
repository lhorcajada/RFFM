#nullable enable
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// CompetitionService.GetCompetitionsAsync used to hardcode "temporada=21" in the
    /// rffm.es API URL. This regression suite asserts the requested URL now uses the
    /// configured RffmOptions.CurrentSeasonId when no explicit season is passed, and the
    /// explicit season when one is provided.
    /// </summary>
    public class CompetitionServiceSeasonTests
    {
        private class CapturingHandler : HttpMessageHandler
        {
            public string? LastRequestUri { get; private set; }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                LastRequestUri = request.RequestUri?.ToString();
                var response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("[]")
                };
                return Task.FromResult(response);
            }
        }

        private static (CompetitionService Service, CapturingHandler Handler) CreateService(int currentSeasonId)
        {
            var handler = new CapturingHandler();
            var httpClient = new HttpClient(handler);
            var matchDayServiceMock = new Moq.Mock<IMatchDayService>();
            var options = Microsoft.Extensions.Options.Options.Create(new RffmOptions { CurrentSeasonId = currentSeasonId });

            var service = new CompetitionService(httpClient, matchDayServiceMock.Object, options);
            return (service, handler);
        }

        [Fact]
        public async Task GetCompetitionsAsync_WithoutExplicitSeason_UsesConfiguredCurrentSeasonId()
        {
            var (service, handler) = CreateService(currentSeasonId: 22);

            await service.GetCompetitionsAsync(cancellationToken: CancellationToken.None);

            Assert.NotNull(handler.LastRequestUri);
            Assert.Contains("temporada=22", handler.LastRequestUri);
        }

        [Fact]
        public async Task GetCompetitionsAsync_WithExplicitSeason_OverridesConfiguredCurrentSeasonId()
        {
            var (service, handler) = CreateService(currentSeasonId: 22);

            await service.GetCompetitionsAsync(temporada: 20, cancellationToken: CancellationToken.None);

            Assert.NotNull(handler.LastRequestUri);
            Assert.Contains("temporada=20", handler.LastRequestUri);
        }
    }
}
