#nullable enable
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using RFFM.Api.Features.Federation.Players.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerServiceRetryTests
    {
        private const string EmptySheet = """{"props":{"pageProps":{"player":null}}}""";
        private const string LoadedSheet = """{"props":{"pageProps":{"player":{"nombre_jugador":"LUCAS PEREZ"}}}}""";

        private class SequenceHandler(params string[] pages) : HttpMessageHandler
        {
            private readonly Queue<string> _pages = new(pages);
            public int Calls { get; private set; }

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Calls++;
                var json = _pages.Count > 1 ? _pages.Dequeue() : _pages.Peek();
                var html = $"<html><body><script id=\"__NEXT_DATA__\" type=\"application/json\">{json}</script></body></html>";
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(html) });
            }
        }

        private static PlayerService Service(SequenceHandler handler)
            => new(new HttpClient(handler), NullLogger<PlayerService>.Instance);

        [Fact]
        public async Task GetPlayerAsync_ShouldRetry_WhenRffmAnswersWithAnEmptySheet()
        {
            var handler = new SequenceHandler(EmptySheet, LoadedSheet);

            var player = await Service(handler).GetPlayerAsync("1001", 22);

            Assert.Equal("LUCAS PEREZ", player?.Name);
        }

        [Fact]
        public async Task GetPlayerAsync_ShouldNotRetry_WhenSheetLoadsAtFirstAttempt()
        {
            var handler = new SequenceHandler(LoadedSheet);

            await Service(handler).GetPlayerAsync("1001", 22);

            Assert.Equal(1, handler.Calls);
        }

        [Fact]
        public async Task GetPlayerAsync_ShouldGiveUpAfterTwoAttempts_WhenSheetStaysEmpty()
        {
            var handler = new SequenceHandler(EmptySheet);

            var player = await Service(handler).GetPlayerAsync("1001", 22);

            Assert.Null(player);
            Assert.Equal(2, handler.Calls);
        }
    }
}
