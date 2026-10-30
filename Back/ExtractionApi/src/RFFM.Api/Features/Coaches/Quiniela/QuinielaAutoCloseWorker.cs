using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>Revisa periódicamente las quinielas para liquidar y abrir jornadas; un fallo nunca detiene el worker.</summary>
    public class QuinielaAutoCloseWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<QuinielaAutoCloseWorker> logger) : BackgroundService
    {
        private const int DefaultPollMinutes = 10;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var minutes = configuration.GetValue("Quiniela:AutoClosePollMinutes", DefaultPollMinutes);
            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, minutes)));
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
                var service = scope.ServiceProvider.GetRequiredService<QuinielaAutoCloseService>();
                await service.RunAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Error en el cierre automático de las quinielas");
            }
        }
    }
}
