using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class GroupRffm
    {
        [JsonPropertyName("codigo")] public string Codigo { get; set; } = string.Empty;

        [JsonPropertyName("nombre")] public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("total_jornadas")] public string Jornadas { get; set; } = string.Empty;

    }
}