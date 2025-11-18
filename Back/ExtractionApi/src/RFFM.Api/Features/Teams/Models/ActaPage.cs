using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Teams.Models
{
    // Represents the Next.js page JSON structure that contains the acta
    public class ActaPage
    {
        [JsonPropertyName("props")]
        public ActaProps? Props { get; set; }
    }

    public class ActaProps
    {
        [JsonPropertyName("pageProps")]
        public ActaPageProps? PageProps { get; set; }
    }

    public class ActaPageProps
    {
        [JsonPropertyName("acta")]
        public Game? Acta { get; set; }

        // In some variants the acta might be nested under a different property name
        [JsonPropertyName("acta_json")] // fallback name (example)
        public Game? ActaJson { get; set; }
    }
}
