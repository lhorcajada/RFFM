using System.Collections.Concurrent;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public interface IKeyedLock
    {
        Task<IDisposable> AcquireAsync(string key, CancellationToken cancellationToken);
    }

    /// <summary>Exclusión mutua por clave dentro del proceso (una instancia).</summary>
    public class KeyedLock : IKeyedLock
    {
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public async Task<IDisposable> AcquireAsync(string key, CancellationToken cancellationToken)
        {
            var semaphore = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            await semaphore.WaitAsync(cancellationToken);
            return new Releaser(semaphore);
        }

        private sealed class Releaser(SemaphoreSlim semaphore) : IDisposable
        {
            private int _disposed;

            public void Dispose()
            {
                if (Interlocked.Exchange(ref _disposed, 1) == 0)
                    semaphore.Release();
            }
        }
    }
}
