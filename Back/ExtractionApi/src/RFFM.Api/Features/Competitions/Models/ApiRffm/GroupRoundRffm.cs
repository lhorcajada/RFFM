using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Competitions.Models.ApiRffm
{
    public class GroupRoundRffm
    {
        [JsonPropertyName("jornadas")]
        public List<MatchDayRffm> MatchDays { get; set; } = [];
    }
}
