using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Competitions.Models.ApiRffm
{
    public class CalendarRffm
    {
        [JsonPropertyName("estado")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("sesion_ok")]
        public string SessionOk { get; set; } = string.Empty;

        [JsonPropertyName("nombre_competicion")]
        public string CompetitionName { get; set; } = string.Empty;

        [JsonPropertyName("codigo_competicion")]
        public string CompetitionCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre_grupo")]
        public string GroupName { get; set; } = string.Empty;

        [JsonPropertyName("codigo_grupo")]
        public string GroupCode { get; set; } = string.Empty;

        [JsonPropertyName("clasificacion_porteros")]
        public string GoalkeeperRanking { get; set; } = string.Empty;

        [JsonPropertyName("visible_goleadores")]
        public string VisibleScorers { get; set; } = string.Empty;

        [JsonPropertyName("visible_clasificacion")]
        public string VisibleClassification { get; set; } = string.Empty;

        [JsonPropertyName("jornada")]
        public string Matchday { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jornada")]
        public string MatchdayName { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jornada_antiguo")]
        public string OldMatchdayName { get; set; } = string.Empty;

        [JsonPropertyName("fecha_jornada")]
        public string MatchdayDate { get; set; } = string.Empty;

        [JsonPropertyName("grupos_competicion")]
        public List<CompetitionGroup> CompetitionGroups { get; set; } = new();

        [JsonPropertyName("listado_jornadas")]
        public List<MatchdayListWrapper> MatchdayList { get; set; } = new();

        [JsonPropertyName("partidos")]
        public List<MatchInfo> Matches { get; set; } = new();

    }
    public class CompetitionGroup
    {
        [JsonPropertyName("codigo")]
        public string Code { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("orden")]
        public string Order { get; set; } = string.Empty;
    }

    public class MatchdayListWrapper
    {
        [JsonPropertyName("estado")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("sesion_ok")]
        public string SessionOk { get; set; } = string.Empty;

        [JsonPropertyName("jornadas")]
        public List<MatchdayEntry> Matchdays { get; set; } = new();
    }

    public class MatchdayEntry
    {
        [JsonPropertyName("codjornada")]
        public string MatchdayCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("nombre_antiguo")]
        public string OldName { get; set; } = string.Empty;

        [JsonPropertyName("fecha_jornada")]
        public string Date { get; set; } = string.Empty;
    }

    public class MatchInfo
    {
        [JsonPropertyName("codacta")]
        public string MatchRecordCode { get; set; } = string.Empty;

        [JsonPropertyName("hay_actas")]
        public string HasRecords { get; set; } = string.Empty;

        [JsonPropertyName("acta_cerrada")]
        public string RecordClosed { get; set; } = string.Empty;

        [JsonPropertyName("situacion_juego")]
        public string GameSituation { get; set; } = string.Empty;

        [JsonPropertyName("observaciones")]
        public string Observations { get; set; } = string.Empty;

        [JsonPropertyName("fecha")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("hora")]
        public string Time { get; set; } = string.Empty;

        [JsonPropertyName("campojuego")]
        public string Field { get; set; } = string.Empty;

        [JsonPropertyName("codigo_campo")]
        public string FieldCode { get; set; } = string.Empty;

        [JsonPropertyName("estado")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("motivo_estado")]
        public string StatusReason { get; set; } = string.Empty;

        [JsonPropertyName("partido_en_juego")]
        public string MatchInProgress { get; set; } = string.Empty;

        [JsonPropertyName("ResultadoProvisional")]
        public string ProvisionalResult { get; set; } = string.Empty;

        [JsonPropertyName("arbitro")]
        public string Referee { get; set; } = string.Empty;

        [JsonPropertyName("penaltis")]
        public string Penalties { get; set; } = string.Empty;

        [JsonPropertyName("ganado_et")]
        public string ExtraTimeWin { get; set; } = string.Empty;

        [JsonPropertyName("equipo_ganador_et")]
        public string ExtraTimeWinnerTeam { get; set; } = string.Empty;

        [JsonPropertyName("CodEquipo_local")]
        public string LocalTeamCode { get; set; } = string.Empty;

        [JsonPropertyName("Nombre_equipo_local")]
        public string LocalTeamName { get; set; } = string.Empty;

        [JsonPropertyName("url_img_local")]
        public string LocalTeamImageUrl { get; set; } = string.Empty;

        [JsonPropertyName("Retirado_local")]
        public string LocalTeamWithdrawn { get; set; } = string.Empty;

        [JsonPropertyName("Goles_casa")]
        public string LocalGoals { get; set; } = string.Empty;

        [JsonPropertyName("penaltis_casa")]
        public string LocalPenalties { get; set; } = string.Empty;

        [JsonPropertyName("CodEquipo_visitante")]
        public string VisitorTeamCode { get; set; } = string.Empty;

        [JsonPropertyName("Nombre_equipo_visitante")]
        public string VisitorTeamName { get; set; } = string.Empty;

        [JsonPropertyName("url_img_visitante")]
        public string VisitorTeamImageUrl { get; set; } = string.Empty;

        [JsonPropertyName("Retirado_visitante")]
        public string VisitorTeamWithdrawn { get; set; } = string.Empty;

        [JsonPropertyName("Goles_visitante")]
        public string VisitorGoals { get; set; } = string.Empty;

        [JsonPropertyName("penaltis_visitante")]
        public string VisitorPenalties { get; set; } = string.Empty;

        [JsonPropertyName("codacta_origen")]
        public string OriginRecordCode { get; set; } = string.Empty;
    }
}
