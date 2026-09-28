using System.Text.Json;
using HtmlAgilityPack;
using RFFM.Api.Features.Federation.Players.Models;

namespace RFFM.Api.Features.Federation.Players.Services;

public static class PlayerSheetParser
{
    public static Player? Parse(string html, string playerId, int seasonId)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;

        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        var scriptNode = doc.DocumentNode.SelectSingleNode("//script[@id='__NEXT_DATA__']");
        if (scriptNode == null) return null;

        JsonDocument jsonDoc;
        try
        {
            jsonDoc = JsonDocument.Parse(scriptNode.InnerText);
        }
        catch (JsonException)
        {
            return null;
        }

        using var _ = jsonDoc;

        if (!jsonDoc.RootElement.TryGetProperty("props", out var props) ||
            !props.TryGetProperty("pageProps", out var pageProps) ||
            !pageProps.TryGetProperty("player", out var playerData) ||
            playerData.ValueKind != JsonValueKind.Object)
            return null;

        var player = new Player
        {
            PlayerId = playerId,
            SeasonId = seasonId.ToString(),
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

        if (playerData.TryGetProperty("partidos", out var partidosArray) && partidosArray.ValueKind == JsonValueKind.Array)
            player.Matches = ParseMatchesData(partidosArray);

        if (playerData.TryGetProperty("tarjetas", out var tarjetasArray) && tarjetasArray.ValueKind == JsonValueKind.Array)
            player.Cards = ParseCardsData(tarjetasArray);

        if (playerData.TryGetProperty("competiciones_participa", out var competicionesArray) && competicionesArray.ValueKind == JsonValueKind.Array)
            player.Competitions = ParseCompetitionsData(competicionesArray);

        return player;
    }

    private static string GetStringValue(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop)) return string.Empty;
        return prop.ValueKind switch
        {
            JsonValueKind.String => prop.GetString() ?? string.Empty,
            JsonValueKind.Number => prop.GetRawText(),
            _ => string.Empty
        };
    }

    private static int GetIntValue(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt32(out var number))
                return number;
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

    private static MatchStatistics ParseMatchesData(JsonElement partidosArray)
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

    private static CardStatistics ParseCardsData(JsonElement tarjetasArray)
    {
        var stats = new CardStatistics();

        foreach (var tarjeta in tarjetasArray.EnumerateArray())
        {
            var codigoTipo = GetStringValue(tarjeta, "codigo_tipo_tarjeta");
            var valor = GetIntValue(tarjeta, "valor");

            switch (codigoTipo)
            {
                case "100":
                    stats.Yellow = valor;
                    break;
                case "101":
                    stats.Red = valor;
                    break;
                case "102":
                    stats.DoubleYellow = valor;
                    break;
            }
        }

        return stats;
    }

    private static List<CompetitionParticipation> ParseCompetitionsData(JsonElement competicionesArray)
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
