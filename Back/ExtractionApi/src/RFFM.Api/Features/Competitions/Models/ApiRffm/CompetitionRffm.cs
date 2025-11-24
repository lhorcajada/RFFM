using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Competitions.Models.ApiRffm
{
    public class CompetitionRffm
    {
        [JsonPropertyName("codigo")]
        public string CompetitionId { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("minutos_juego")]
        public string MatchTime { get; set; } = string.Empty;


    }
}
