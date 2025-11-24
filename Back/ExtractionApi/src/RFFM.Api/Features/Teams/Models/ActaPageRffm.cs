using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Teams.Models
{
    // Represents the Next.js page JSON structure that contains the acta
    public class ActaPageRffm
    {
        [JsonPropertyName("props")]
        public ActaPropsRffm? Props { get; set; }
    }

    public class ActaPropsRffm
    {
        [JsonPropertyName("pageProps")]
        public ActaPagePropsRffm? PageProps { get; set; }
    }

    public class ActaPagePropsRffm
    {
        [JsonPropertyName("acta")]
        public MatchRffm? Acta { get; set; }

        // In some variants the acta might be nested under a different property name
        [JsonPropertyName("acta_json")] // fallback name (example)
        public MatchRffm? ActaJson { get; set; }
    }
}
