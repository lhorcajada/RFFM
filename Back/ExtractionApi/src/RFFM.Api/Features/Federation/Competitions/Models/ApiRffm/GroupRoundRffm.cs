using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class GroupRoundRffm
    {
        [JsonPropertyName("jornadas")]
        public List<MatchDayRffm> MatchDays { get; set; } = [];
    }
}
