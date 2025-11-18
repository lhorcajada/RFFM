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

        // Computed: the jornada code (parsed to int) that should be shown as active by default.
        // This is computed by the service and serialized to the client so the UI can open the correct tab.
        [JsonPropertyName("active_jornada")]
        public int ActiveJornada { get; set; } = 0;

        // Computed: zero-based index in EffectiveRounds corresponding to the active jornada when available.
        [JsonPropertyName("active_round_index")]
        public int ActiveRoundIndex { get; set; } = -1;
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
        // Full URL for the local team shield (computed). Ensures front can download even when source provides a relative path.
        [JsonPropertyName("escudo_equipo_local_url")] public string LocalTeamShieldUrl => NormalizeShieldUrl(LocalTeamShield);
        [JsonPropertyName("equipo_local")] public string LocalTeamName { get; set; } = string.Empty;
        [JsonPropertyName("goles_casa")] public string LocalGoals { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo_visitante")] public string AwayTeamCode { get; set; } = string.Empty;
        [JsonPropertyName("escudo_equipo_visitante")] public string AwayTeamShield { get; set; } = string.Empty;
        // Full URL for the away team shield (computed)
        [JsonPropertyName("escudo_equipo_visitante_url")] public string AwayTeamShieldUrl => NormalizeShieldUrl(AwayTeamShield);
        [JsonPropertyName("equipo_visitante")] public string AwayTeamName { get; set; } = string.Empty;
        [JsonPropertyName("goles_visitante")] public string AwayGoals { get; set; } = string.Empty;

        [JsonPropertyName("codigo_campo")] public string FieldCode { get; set; } = string.Empty;
        [JsonPropertyName("campo")] public string Field { get; set; } = string.Empty;

        // date and time strings as present in the source JSON (e.g. "11/10/2025", "09:00")
        [JsonPropertyName("fecha")] public string Fecha { get; set; } = string.Empty;
        [JsonPropertyName("hora")] public string Hora { get; set; } = string.Empty;

        // additional fields might exist in different payloads, preserve raw JSON by allowing extra properties if needed

        private static string NormalizeShieldUrl(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
            var s = raw.Trim();
            // If already absolute, return as-is
            if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                return s;

            // Scheme-relative (//domain/path)
            if (s.StartsWith("//"))
                return "https:" + s;

            // If starts with '/', treat as path on appweb.rffm.es (observed in source)
            if (s.StartsWith("/"))
                return "https://appweb.rffm.es" + s;

            // otherwise assume relative path
            return "https://appweb.rffm.es/" + s;
        }
    }
}
