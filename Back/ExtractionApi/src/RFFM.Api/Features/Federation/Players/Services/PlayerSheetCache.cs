using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public static class PlayerSheetCache
{
    private static readonly TimeSpan Expiration = TimeSpan.FromMinutes(10);

    public static async Task<Player?> GetPlayerSheetOrDefaultAsync(this IMemoryCache cache, IPlayerService playerService,
        string playerId, int seasonId, CancellationToken cancellationToken)
    {
        try
        {
            return await cache.GetOrCreateAsync($"player_{playerId}_{seasonId}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = Expiration;
                return await playerService.GetPlayerAsync(playerId, seasonId, cancellationToken);
            });
        }
        catch
        {
            // una ficha que falla no debe tumbar el resto de la respuesta
            return null;
        }
    }
}
