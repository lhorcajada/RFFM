using Polly.CircuitBreaker;
using Polly.Timeout;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public static class RffmErrors
    {
        /// <summary>Error de red/timeout tras agotar los reintentos: se registra y se continúa.</summary>
        public static bool IsRecoverable(Exception ex) =>
            ex is HttpRequestException or TimeoutRejectedException or TaskCanceledException { InnerException: TimeoutException };

        public static bool IsRecoverableOrCircuitOpen(Exception ex) => IsRecoverable(ex) || ex is BrokenCircuitException;
    }
}
