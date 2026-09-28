using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public static class RffmBackgroundHttp
    {
        public const string ClientName = "RffmBackground";

        public static IHttpClientBuilder AddRffmBackgroundHttpClient(this IServiceCollection services)
        {
            services.TryAddSingleton(TimeProvider.System);
            services.AddSingleton<RffmRequestGate>();
            services.AddTransient<RffmThrottlingHandler>();

            var builder = services.AddHttpClient(ClientName, client =>
            {
                client.BaseAddress = new Uri("https://www.rffm.es/");
                client.Timeout = TimeSpan.FromMinutes(3);
                client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
                client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8");
                client.DefaultRequestHeaders.TryAddWithoutValidation("Accept-Language", "es-ES,es;q=0.9");
            });

            builder.AddResilienceHandler("rffm", (pipeline, context) =>
            {
                var options = context.ServiceProvider.GetRequiredService<IOptions<RffmOptions>>().Value;

                pipeline.AddRetry(new HttpRetryStrategyOptions
                {
                    MaxRetryAttempts = 4,
                    BackoffType = DelayBackoffType.Exponential,
                    Delay = TimeSpan.FromMilliseconds(options.BackgroundRetryBaseDelayMs),
                    UseJitter = true,
                    ShouldRetryAfterHeader = true
                });

                pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
                {
                    FailureRatio = 0.5,
                    MinimumThroughput = 10,
                    SamplingDuration = TimeSpan.FromSeconds(60),
                    BreakDuration = TimeSpan.FromSeconds(60)
                });

                pipeline.AddTimeout(TimeSpan.FromSeconds(20));
            });

            // Añadido después de la resiliencia: cada intento real (también los reintentos) espera turno.
            builder.AddHttpMessageHandler<RffmThrottlingHandler>();

            return builder;
        }
    }

    public class RffmRequestGate(IOptions<RffmOptions> options)
    {
        private readonly SemaphoreSlim _lock = new(1, 1);
        private DateTime _lastRequestFinishedAt = DateTime.MinValue;

        public async Task<T> RunAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken)
        {
            await _lock.WaitAsync(cancellationToken);
            try
            {
                var minDelay = options.Value.BackgroundMinDelayMs * (0.75 + Random.Shared.NextDouble() * 0.5);
                var elapsed = (DateTime.UtcNow - _lastRequestFinishedAt).TotalMilliseconds;
                var pending = minDelay - elapsed;
                if (pending > 0)
                    await Task.Delay(TimeSpan.FromMilliseconds(pending), cancellationToken);

                return await action();
            }
            finally
            {
                _lastRequestFinishedAt = DateTime.UtcNow;
                _lock.Release();
            }
        }
    }

    public class RffmThrottlingHandler(RffmRequestGate gate) : DelegatingHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            gate.RunAsync(() => base.SendAsync(request, cancellationToken), cancellationToken);
    }
}
