using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class CompetitionRffm
    {
        [JsonPropertyName("codigo")]
        public string CompetitionId { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("minutos_juego")]
        public string MatchTime { get; set; } = string.Empty;

        [JsonPropertyName("numero_partes")]
        public string MatchParts { get; set; } = string.Empty;

        [JsonPropertyName("ptos_ganado")]
        public string PointsWin { get; set; } = string.Empty;

        [JsonPropertyName("ptos_empatado")]
        public string PointsDraw { get; set; } = string.Empty;

        [JsonPropertyName("ptos_perdido")]
        public string PointsLoss { get; set; } = string.Empty;

        [JsonPropertyName("nombre_grupo_categoria")]
        public string CategoryGroup { get; set; } = string.Empty;


    }
}
