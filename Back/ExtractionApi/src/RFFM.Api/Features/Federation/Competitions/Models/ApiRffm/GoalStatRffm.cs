using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class GoalStatRffm
    {
        [JsonPropertyName("codigo_jugador")]
        public string PlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("foto")]
        public string Photo { get; set; } = string.Empty;

        [JsonPropertyName("jugador")]
        public string PlayerName { get; set; } = string.Empty;

        [JsonPropertyName("escudo_equipo")]
        public string TeamShield { get; set; } = string.Empty;

        [JsonPropertyName("nombre_equipo")]
        public string TeamName { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo")]
        public string TeamCode { get; set; } = string.Empty;

        [JsonPropertyName("partidos_jugados")]
        public string MatchesPlayed { get; set; } = string.Empty;

        [JsonPropertyName("goles")]
        public string Goals { get; set; } = string.Empty;

        [JsonPropertyName("goles_penalti")]
        public string PenaltyGoals { get; set; } = string.Empty;

        [JsonPropertyName("goles_por_partidos")]
        public string GoalsPerMatch { get; set; } = string.Empty;
    }
}
