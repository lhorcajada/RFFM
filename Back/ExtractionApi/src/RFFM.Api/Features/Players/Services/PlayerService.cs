using System.Text.Json;
using HtmlAgilityPack;
using Microsoft.Extensions.Logging;
using RFFM.Api.Features.Players.Models;

namespace RFFM.Api.Features.Players.Services;

public class PlayerService : IPlayerService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PlayerService> _logger;

    public PlayerService(HttpClient httpClient, ILogger<PlayerService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Player?> GetPlayerAsync(string playerId, string seasonId, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"{PlayerConstants.BaseUrl}/{playerId}?temporada={seasonId}";
            var html = await _httpClient.GetStringAsync(url, cancellationToken);
            
            return ParsePlayerData(html, playerId, seasonId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos del jugador {PlayerId}", playerId);
            return null;
        }
    }

    private Player? ParsePlayerData(string html, string playerId, string seasonId)
    {
        try
        {
            // Extraer el JSON del script tag __NEXT_DATA__
            var doc = new HtmlDocument();
            doc.LoadHtml(html);
            
            var scriptNode = doc.DocumentNode.SelectSingleNode("//script[@id='__NEXT_DATA__']");
            if (scriptNode == null)
            {
                _logger.LogWarning("No se encontró el script __NEXT_DATA__ para el jugador {PlayerId}", playerId);
                return null;
            }

            var jsonContent = scriptNode.InnerText;
            var jsonDoc = JsonDocument.Parse(jsonContent);
            
            // Navegar a props.pageProps.player
            if (!jsonDoc.RootElement.TryGetProperty("props", out var props) ||
                !props.TryGetProperty("pageProps", out var pageProps) ||
                !pageProps.TryGetProperty("player", out var playerData))
            {
                _logger.LogWarning("No se encontró la estructura de datos esperada para el jugador {PlayerId}", playerId);
                return null;
            }

            var player = new Player
            {
                PlayerId = playerId,
                SeasonId = seasonId,
                Name = GetStringValue(playerData, "nombre_jugador"),
                Age = GetIntValue(playerData, "edad"),
                BirthYear = GetIntValue(playerData, "anio_nacimiento"),
                Team = GetStringValue(playerData, "equipo"),
                TeamCode = GetStringValue(playerData, "codigo_equipo"),
                TeamCategory = GetStringValue(playerData, "categoria_equipo"),
                JerseyNumber = GetStringValue(playerData, "dorsal_jugador"),
                Position = GetStringValue(playerData, "posicion_jugador"),
                IsGoalkeeper = GetStringValue(playerData, "es_portero") == "1",
                PhotoUrl = GetStringValue(playerData, "foto"),
                TeamShieldUrl = GetStringValue(playerData, "escudo_equipo")
            };

            // Parsear partidos
            if (playerData.TryGetProperty("partidos", out var partidosArray))
            {
                player.Matches = ParseMatchesData(partidosArray);
            }

            // Parsear tarjetas
            if (playerData.TryGetProperty("tarjetas", out var tarjetasArray))
            {
                player.Cards = ParseCardsData(tarjetasArray);
            }

            // Parsear competiciones
            if (playerData.TryGetProperty("competiciones_participa", out var competicionesArray))
            {
                player.Competitions = ParseCompetitionsData(competicionesArray);
            }

            return player;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parseando datos del jugador {PlayerId}", playerId);
            return null;
        }
    }

    private static string GetStringValue(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var prop) ? prop.GetString() ?? string.Empty : string.Empty;
    }

    private static int GetIntValue(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.Number)
                return prop.GetInt32();
            if (prop.ValueKind == JsonValueKind.String && int.TryParse(prop.GetString(), out var result))
                return result;
        }
        return 0;
    }

    private static decimal GetDecimalValue(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.Number)
                return prop.GetDecimal();
            if (prop.ValueKind == JsonValueKind.String && decimal.TryParse(prop.GetString(), out var result))
                return result;
        }
        return 0;
    }

    private MatchStatistics ParseMatchesData(JsonElement partidosArray)
    {
        var stats = new MatchStatistics();
        
        foreach (var partido in partidosArray.EnumerateArray())
        {
            var nombre = GetStringValue(partido, "nombre");
            var valor = GetIntValue(partido, "valor");

            switch (nombre.ToLowerInvariant())
            {
                case "convocados":
                    stats.Called = valor;
                    break;
                case "titular":
                    stats.Starter = valor;
                    break;
                case "suplente":
                    stats.Substitute = valor;
                    break;
                case "jugados":
                    stats.Played = valor;
                    break;
                case "total goles":
                    stats.TotalGoals = valor;
                    break;
                case "media goles por partido":
                    stats.GoalsPerMatch = GetDecimalValue(partido, "valor");
                    break;
            }
        }

        return stats;
    }

    private CardStatistics ParseCardsData(JsonElement tarjetasArray)
    {
        var stats = new CardStatistics();

        foreach (var tarjeta in tarjetasArray.EnumerateArray())
        {
            var codigoTipo = GetStringValue(tarjeta, "codigo_tipo_tarjeta");
            var valor = GetIntValue(tarjeta, "valor");

            switch (codigoTipo)
            {
                case "100": // Amarillas
                    stats.Yellow = valor;
                    break;
                case "101": // Rojas
                    stats.Red = valor;
                    break;
                case "102": // Doble Amarilla
                    stats.DoubleYellow = valor;
                    break;
            }
        }

        return stats;
    }

    private List<CompetitionParticipation> ParseCompetitionsData(JsonElement competicionesArray)
    {
        var competitions = new List<CompetitionParticipation>();

        foreach (var competicion in competicionesArray.EnumerateArray())
        {
            competitions.Add(new CompetitionParticipation
            {
                CompetitionName = GetStringValue(competicion, "nombre_competicion"),
                CompetitionCode = GetStringValue(competicion, "codigo_competicion"),
                GroupCode = GetStringValue(competicion, "codgrupo"),
                GroupName = GetStringValue(competicion, "nombre_grupo"),
                TeamCode = GetStringValue(competicion, "codequipo"),
                TeamName = GetStringValue(competicion, "nombre_equipo"),
                ClubName = GetStringValue(competicion, "nombre_club"),
                TeamPosition = GetIntValue(competicion, "posicion_equipo"),
                TeamPoints = GetIntValue(competicion, "puntos_equipo"),
                TeamShieldUrl = GetStringValue(competicion, "escudo_equipo"),
                ShowStatistics = GetStringValue(competicion, "ver_estadisticas") == "1"
            });
        }

        return competitions;
    }
}
