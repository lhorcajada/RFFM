using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Competitions.Models
{
    // Represents the root `calendar` object embedded in the site JSON
    public class Calendar
    {
        [JsonPropertyName("estado")] public string Estado { get; set; } = string.Empty;
        [JsonPropertyName("sesion_ok")] public string SesionOk { get; set; } = string.Empty;
        [JsonPropertyName("competicion")] public string Competicion { get; set; } = string.Empty;
        [JsonPropertyName("tipo_competicion")] public string TipoCompeticion { get; set; } = string.Empty;
        [JsonPropertyName("grupo")] public string Grupo { get; set; } = string.Empty;
        [JsonPropertyName("temporada")] public string Temporada { get; set; } = string.Empty;

        // JSON may use different property names for rounds: "rounds" or "jornadas"
        [JsonPropertyName("rounds")] public List<CalendarRound>? Rounds { get; set; } = new();
        [JsonPropertyName("jornadas")] public List<CalendarRound>? Jornadas { get; set; } = new();

        // Helper to get whichever is populated
        [JsonIgnore]
        public List<CalendarRound> EffectiveRounds => (Rounds != null && Rounds.Count > 0) ? Rounds : (Jornadas ?? new List<CalendarRound>());
    }

    public class CalendarRound
    {
        [JsonPropertyName("codjornada")] public string CodJornada { get; set; } = string.Empty;
        [JsonPropertyName("jornada")] public string Jornada { get; set; } = string.Empty;
        // Matches may be named "equipos" or "partidos" in different payloads
        [JsonPropertyName("equipos")] public List<CalendarMatch>? Matches { get; set; } = new();
        [JsonPropertyName("partidos")] public List<CalendarMatch>? Partidos { get; set; } = new();

        [JsonIgnore]
        public List<CalendarMatch> EffectiveMatches => (Matches != null && Matches.Count > 0) ? Matches : (Partidos ?? new List<CalendarMatch>());
    }

    public class CalendarMatch
    {
        [JsonPropertyName("codacta")] public string CodActa { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo_local")] public string LocalTeamCode { get; set; } = string.Empty;
        [JsonPropertyName("escudo_equipo_local")] public string LocalTeamShield { get; set; } = string.Empty;
        [JsonPropertyName("equipo_local")] public string LocalTeamName { get; set; } = string.Empty;
        [JsonPropertyName("goles_casa")] public string LocalGoals { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo_visitante")] public string AwayTeamCode { get; set; } = string.Empty;
        [JsonPropertyName("escudo_equipo_visitante")] public string AwayTeamShield { get; set; } = string.Empty;
        [JsonPropertyName("equipo_visitante")] public string AwayTeamName { get; set; } = string.Empty;
        [JsonPropertyName("goles_visitante")] public string AwayGoals { get; set; } = string.Empty;

        [JsonPropertyName("codigo_campo")] public string FieldCode { get; set; } = string.Empty;
        [JsonPropertyName("campo")] public string Field { get; set; } = string.Empty;

        // date and time strings as present in the source JSON (e.g. "11/10/2025", "09:00")
        [JsonPropertyName("fecha")] public string Fecha { get; set; } = string.Empty;
        [JsonPropertyName("hora")] public string Hora { get; set; } = string.Empty;

        // additional fields might exist in different payloads, preserve raw JSON by allowing extra properties if needed
    }
}
