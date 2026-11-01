using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.Features.Federation.Competitions.Models;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    /// <summary>
    /// Cachea las jornadas de un grupo (cambian muy poco) y la jornada activa. Una lista vacía o un null se
    /// consideran fallo y no se guardan.
    /// </summary>
    public class CachedMatchDayService(IMatchDayService inner, IMemoryCache cache) : IMatchDayService
    {
        private static readonly TimeSpan MatchDaysTtl = TimeSpan.FromHours(6);
        private static readonly TimeSpan ActiveMatchDayTtl = TimeSpan.FromMinutes(30);

        public async Task<List<MatchDayResponse>> GetMatchDays(int groupId, CancellationToken cancellationToken)
        {
            var key = $"rffm:matchdays:{groupId}";
            if (cache.TryGetValue(key, out List<MatchDayResponse>? cached) && cached is not null)
                return cached;

            var result = await inner.GetMatchDays(groupId, cancellationToken).ConfigureAwait(false);
            if (result.Count > 0)
                cache.Set(key, result, MatchDaysTtl);
            return result;
        }

        public async Task<MatchDayResponse?> GetActiveMatchDay(int groupId, CancellationToken cancellationToken)
        {
            var key = $"rffm:active-matchday:{groupId}";
            if (cache.TryGetValue(key, out MatchDayResponse? cached) && cached is not null)
                return cached;

            var result = await inner.GetActiveMatchDay(groupId, cancellationToken).ConfigureAwait(false);
            if (result is not null)
                cache.Set(key, result, ActiveMatchDayTtl);
            return result;
        }
    }
}
