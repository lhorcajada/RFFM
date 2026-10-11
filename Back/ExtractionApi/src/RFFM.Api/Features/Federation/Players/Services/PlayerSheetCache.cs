using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public static class PlayerSheetCache
{
    private static readonly TimeSpan Expiration = TimeSpan.FromMinutes(10);

    public static async Task<Player?> GetPlayerSheetOrDefaultAsync(this IMemoryCache cache, IPlayerService playerService,
        string playerId, int seasonId, CancellationToken cancellationToken)
    {
        var cacheKey = $"player_{playerId}_{seasonId}";
        if (cache.TryGetValue(cacheKey, out Player? cached) && cached is not null)
            return cached;

        try
        {
            var sheet = await playerService.GetPlayerAsync(playerId, seasonId, cancellationToken);
            // solo se cachea la ficha cargada: un fallo puntual de la RFFM debe reintentarse en la siguiente petición
            if (sheet is not null)
                cache.Set(cacheKey, sheet, Expiration);
            return sheet;
        }
        catch
        {
            // una ficha que falla no debe tumbar el resto de la respuesta
            return null;
        }
    }
}
