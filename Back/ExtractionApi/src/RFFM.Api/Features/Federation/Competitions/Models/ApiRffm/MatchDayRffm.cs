using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class MatchDayRffm
    {
        [JsonPropertyName("codjornada")]
        public string MatchDayCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("nombre_antiguo")]
        public string OldName { get; set; } = string.Empty;

        [JsonPropertyName("fecha_jornada")]
        public string MatchDayDate { get; set; } = string.Empty;
    }
}
