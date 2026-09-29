using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.MatchResultNotifications.Services
{
    /// <summary>Revisa periódicamente los resultados de los equipos seguidos; un fallo nunca detiene el worker.</summary>
    public class MatchResultNotificationWorker(
        IServiceScopeFactory scopeFactory,
        IOptions<RffmOptions> options,
        ILogger<MatchResultNotificationWorker> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var period = TimeSpan.FromMinutes(Math.Max(1, options.Value.Results.ResultNotificationPollMinutes));
            using var timer = new PeriodicTimer(period);
            try
            {
                do
                {
                    await RunOnceAsync(stoppingToken);
                } while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
            }
        }

        private async Task RunOnceAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IMatchResultNotificationService>();
                await service.RunAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error revisando los resultados para notificar");
            }
        }
    }
}
