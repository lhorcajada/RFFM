using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Federation.Competitions.Models.ApiRffm
{
    public class StandingRffm
    {
        [JsonPropertyName("clasificacion")]
        public ClassificationRffm[] Classification { get; set; } = [];
    }

    public class ClassificationRffm
    {
        [JsonPropertyName("color")]
        public string Color { get; set; } = string.Empty;

        [JsonPropertyName("posicion")]
        public string Position { get; set; } = string.Empty;

        [JsonPropertyName("url_img")]
        public string ImageUrl { get; set; } = string.Empty;

        [JsonPropertyName("codequipo")]
        public string TeamId { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string TeamName { get; set; } = string.Empty;

        [JsonPropertyName("jugados")]
        public string Played { get; set; } = string.Empty;

        [JsonPropertyName("ganados")]
        public string Won { get; set; } = string.Empty;

        [JsonPropertyName("perdidos")]
        public string Lost { get; set; } = string.Empty;

        [JsonPropertyName("empatados")]
        public string Drawn { get; set; } = string.Empty;

        [JsonPropertyName("penaltis")]
        public string Penalties { get; set; } = string.Empty;

        [JsonPropertyName("goles_a_favor")]
        public string GoalsFor { get; set; } = string.Empty;

        [JsonPropertyName("goles_en_contra")]
        public string GoalsAgainst { get; set; } = string.Empty;

        [JsonPropertyName("jugados_casa")]
        public string HomePlayed { get; set; } = string.Empty;

        [JsonPropertyName("ganados_casa")]
        public string HomeWon { get; set; } = string.Empty;

        [JsonPropertyName("empatados_casa")]
        public string HomeDrawn { get; set; } = string.Empty;

        [JsonPropertyName("ganados_penalti_casa")]
        public string HomePenaltyWins { get; set; } = string.Empty;

        [JsonPropertyName("perdidos_casa")]
        public string HomeLost { get; set; } = string.Empty;

        [JsonPropertyName("jugados_fuera")]
        public string AwayPlayed { get; set; } = string.Empty;

        [JsonPropertyName("ganados_fuera")]
        public string AwayWon { get; set; } = string.Empty;

        [JsonPropertyName("empatados_fuera")]
        public string AwayDrawn { get; set; } = string.Empty;

        [JsonPropertyName("ganados_penalti_fuera")]
        public string AwayPenaltyWins { get; set; } = string.Empty;

        [JsonPropertyName("perdidos_fuera")]
        public string AwayLost { get; set; } = string.Empty;

        [JsonPropertyName("puntos")]
        public string Points { get; set; } = string.Empty;

        [JsonPropertyName("puntos_sancion")]
        public string SanctionPoints { get; set; } = string.Empty;

        [JsonPropertyName("puntos_local")]
        public string HomePoints { get; set; } = string.Empty;

        [JsonPropertyName("puntos_visitante")]
        public string AwayPoints { get; set; } = string.Empty;

        [JsonPropertyName("mostrar_coeficiente")]
        public string ShowCoefficient { get; set; } = string.Empty;

        [JsonPropertyName("coeficiente")]
        public string Coefficient { get; set; } = string.Empty;

        [JsonPropertyName("racha_partidos")]
        public List<MatchStreak> MatchStreaks { get; set; } = [];
    }

    public class MatchStreak
    {
        //G = Ganado, P = Perdido, E = Empatado
        [JsonPropertyName("tipo")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("color")]
        public string Color { get; set; } = string.Empty;
    }

    public class GroupRounds
    {
        [JsonPropertyName("jornadas")]
        public List<Round> Rounds { get; set; } = [];

    }

    public class Round
    {
        [JsonPropertyName("codjornada")]
        // Some endpoints return codjornada as number, others as string. Keep as string and parse when needed.
        public string JourneyId { get; set; } = string.Empty;
        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;
        [JsonPropertyName("fecha_jornada")]
        public string Date { get; set; } = string.Empty;

    }
}
