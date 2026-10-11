using Microsoft.Extensions.Logging;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public class PlayerService : IPlayerService
{
    private const int MaxAttempts = 2;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMilliseconds(400);

    private readonly HttpClient _httpClient;
    private readonly ILogger<PlayerService> _logger;

    public PlayerService(HttpClient httpClient, ILogger<PlayerService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    private async Task<Player?> FetchSheetAsync(string url, string playerId, int seasonId, CancellationToken cancellationToken)
    {
        var html = await _httpClient.GetStringAsync(url, cancellationToken);
        return PlayerSheetParser.Parse(html, playerId, seasonId);
    }

    public async Task<Player?> GetPlayerAsync(string playerId, int seasonId, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{PlayerConstants.BaseUrl}/{playerId}?temporada={seasonId}";

            // la RFFM responde a veces 200 con la ficha vacía ("player": null) aunque el jugador exista
            var player = await FetchSheetAsync(url, playerId, seasonId, cancellationToken);
            for (var attempt = 1; player == null && attempt < MaxAttempts; attempt++)
            {
                await Task.Delay(RetryDelay, cancellationToken);
                player = await FetchSheetAsync(url, playerId, seasonId, cancellationToken);
            }

            if (player == null)
                _logger.LogWarning("No se encontró la estructura de datos esperada para el jugador {PlayerId}", playerId);

            return player;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos del jugador {PlayerId}", playerId);
            return null;
        }
    }
}
