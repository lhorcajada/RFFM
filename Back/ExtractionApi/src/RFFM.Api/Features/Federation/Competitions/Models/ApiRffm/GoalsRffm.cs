using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class GoalsRffm
    {
        [JsonPropertyName("estado")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("sesion_ok")]
        public string SessionOk { get; set; } = string.Empty;

        [JsonPropertyName("competicion")]
        public string Competition { get; set; } = string.Empty;

        [JsonPropertyName("grupo")]
        public string Group { get; set; } = string.Empty;

        [JsonPropertyName("goles")]
        public List<GoalStatRffm> Goals { get; set; } = new();
    }
}
