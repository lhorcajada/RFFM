using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.Features.Federation.Competitions.Models;
using static RFFM.Api.Features.Federation.Competitions.Queries.GetScores;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    /// <summary>
    /// Evita repetir las mismas peticiones a la RFFM. Solo guarda respuestas con datos: una lista vacía suele ser un
    /// fallo de la RFFM (el servicio real los silencia), así que se vuelve a intentar en la siguiente petición.
    /// </summary>
    public class CachedCompetitionService(ICompetitionService inner, IMemoryCache cache) : ICompetitionService
    {
        private static readonly TimeSpan StaticDataTtl = TimeSpan.FromHours(6);
        private static readonly TimeSpan ScorersTtl = TimeSpan.FromMinutes(15);
        private static readonly TimeSpan ClassificationTtl = TimeSpan.FromMinutes(10);

        public Task<ResponseCompetition[]> GetCompetitionsAsync(int? temporada = null, CancellationToken cancellationToken = default) =>
            GetOrFetchAsync($"rffm:competitions:{temporada?.ToString() ?? "current"}", StaticDataTtl,
                () => inner.GetCompetitionsAsync(temporada, cancellationToken), r => r.Length > 0);

        public Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default) =>
            GetOrFetchAsync($"rffm:groups:{competitionId}", StaticDataTtl,
                () => inner.GetGroupsAsync(competitionId, cancellationToken), r => r.Length > 0);

        public Task<ResponseScores[]> GetScoresAsync(string competitionId, string groupId, CancellationToken cancellationToken = default) =>
            GetOrFetchAsync($"rffm:scorers:{competitionId}:{groupId}", ScorersTtl,
                () => inner.GetScoresAsync(competitionId, groupId, cancellationToken), r => r.Length > 0);

        public Task<ClassificationResponse> GetClassification(int groupId, CancellationToken cancellationToken) =>
            GetOrFetchAsync($"rffm:classification:{groupId}", ClassificationTtl,
                () => inner.GetClassification(groupId, cancellationToken), r => r.Teams.Count > 0);

        private async Task<T> GetOrFetchAsync<T>(string key, TimeSpan ttl, Func<Task<T>> fetch, Func<T, bool> hasData)
            where T : class
        {
            if (cache.TryGetValue(key, out T? cached) && cached is not null)
                return cached;

            var result = await fetch().ConfigureAwait(false);
            if (hasData(result))
                cache.Set(key, result, ttl);
            return result;
        }
    }
}
