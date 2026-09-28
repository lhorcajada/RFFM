using Microsoft.Extensions.Logging;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public class PlayerService : IPlayerService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PlayerService> _logger;

    public PlayerService(HttpClient httpClient, ILogger<PlayerService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Player?> GetPlayerAsync(string playerId, int seasonId, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{PlayerConstants.BaseUrl}/{playerId}?temporada={seasonId}";
            var html = await _httpClient.GetStringAsync(url, cancellationToken);

            var player = PlayerSheetParser.Parse(html, playerId, seasonId);
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
