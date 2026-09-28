using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RffmBackgroundHttpClientTests
    {
        private sealed class ScriptedHandler : HttpMessageHandler
        {
            private readonly ConcurrentQueue<HttpStatusCode> _responses;
            private int _inFlight;

            public ScriptedHandler(params HttpStatusCode[] responses) =>
                _responses = new ConcurrentQueue<HttpStatusCode>(responses);

            public int Calls;
            public int MaxConcurrency;
            public ConcurrentBag<DateTime> StartTimes { get; } = new();

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Interlocked.Increment(ref Calls);
                StartTimes.Add(DateTime.UtcNow);
                var current = Interlocked.Increment(ref _inFlight);
                MaxConcurrency = Math.Max(MaxConcurrency, current);
                await Task.Delay(20, cancellationToken);
                Interlocked.Decrement(ref _inFlight);
                var status = _responses.TryDequeue(out var s) ? s : HttpStatusCode.OK;
                return new HttpResponseMessage(status) { Content = new StringContent("ok") };
            }
        }

        private static HttpClient BuildClient(ScriptedHandler handler, int minDelayMs = 1)
        {
            var services = new ServiceCollection();
            services.Configure<RffmOptions>(o =>
            {
                o.BackgroundMinDelayMs = minDelayMs;
                o.BackgroundRetryBaseDelayMs = 1;
            });
            services.AddRffmBackgroundHttpClient()
                .ConfigurePrimaryHttpMessageHandler(() => handler);

            return services.BuildServiceProvider()
                .GetRequiredService<IHttpClientFactory>()
                .CreateClient(RffmBackgroundHttp.ClientName);
        }

        [Fact]
        public async Task Reintenta_un_error_503_y_devuelve_la_respuesta_correcta()
        {
            var handler = new ScriptedHandler(HttpStatusCode.ServiceUnavailable, HttpStatusCode.OK);
            var client = BuildClient(handler);

            var response = await client.GetAsync("https://www.rffm.es/test");

            Assert.Equal((HttpStatusCode.OK, 2), (response.StatusCode, handler.Calls));
        }

        [Fact]
        public async Task No_reintenta_un_404()
        {
            var handler = new ScriptedHandler(HttpStatusCode.NotFound);
            var client = BuildClient(handler);

            var response = await client.GetAsync("https://www.rffm.es/test");

            Assert.Equal((HttpStatusCode.NotFound, 1), (response.StatusCode, handler.Calls));
        }

        [Fact]
        public async Task Nunca_lanza_dos_peticiones_en_paralelo()
        {
            var handler = new ScriptedHandler();
            var client = BuildClient(handler);

            await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => client.GetAsync("https://www.rffm.es/test")));

            Assert.Equal(1, handler.MaxConcurrency);
        }

        [Fact]
        public async Task Espera_la_pausa_minima_entre_peticiones()
        {
            var handler = new ScriptedHandler();
            var client = BuildClient(handler, minDelayMs: 200);

            var stopwatch = Stopwatch.StartNew();
            await client.GetAsync("https://www.rffm.es/a");
            await client.GetAsync("https://www.rffm.es/b");
            await client.GetAsync("https://www.rffm.es/c");

            // 2 pausas de al menos 200 ms * 0,75 (jitter mínimo)
            Assert.True(stopwatch.ElapsedMilliseconds >= 300, $"Transcurrido: {stopwatch.ElapsedMilliseconds} ms");
        }
    }
}
