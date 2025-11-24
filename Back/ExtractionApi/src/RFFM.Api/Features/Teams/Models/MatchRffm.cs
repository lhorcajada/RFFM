using System.Text.Json.Serialization;


namespace RFFM.Api.Features.Teams.Models
{

    public class MatchRffm
    {
        [JsonPropertyName("estado")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("sesion_ok")]
        public string SessionOk { get; set; } = string.Empty;

        [JsonPropertyName("codacta")]
        public string MatchRecordCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre_competicion")]
        public string CompetitionName { get; set; } = string.Empty;

        [JsonPropertyName("nombre_grupo")]
        public string GroupName { get; set; } = string.Empty;

        [JsonPropertyName("jornada")]
        public string Matchday { get; set; } = string.Empty;

        [JsonPropertyName("fecha")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("hora")]
        public string Time { get; set; } = string.Empty;

        [JsonPropertyName("campo")]
        public string Field { get; set; } = string.Empty;

        [JsonPropertyName("codigo_campo")]
        public string FieldCode { get; set; } = string.Empty;

        [JsonPropertyName("acta_cerrada")]
        public string RecordClosed { get; set; } = string.Empty;

        [JsonPropertyName("partido_en_juego")]
        public string MatchInProgress { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo_local")]
        public string LocalTeamCode { get; set; } = string.Empty;

        [JsonPropertyName("esquema_local")]
        public string LocalFormation { get; set; } = string.Empty;

        [JsonPropertyName("equipo_local")]
        public string LocalTeam { get; set; } = string.Empty;

        [JsonPropertyName("escudo_local")]
        public string LocalShield { get; set; } = string.Empty;

        [JsonPropertyName("goles_local")]
        public string LocalGoals { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo_visitante")]
        public string AwayTeamCode { get; set; } = string.Empty;

        [JsonPropertyName("esquema_visitante")]
        public string AwayFormation { get; set; } = string.Empty;

        [JsonPropertyName("equipo_visitante")]
        public string AwayTeam { get; set; } = string.Empty;

        [JsonPropertyName("escudo_visitante")]
        public string AwayShield { get; set; } = string.Empty;

        [JsonPropertyName("goles_visitante")]
        public string AwayGoals { get; set; } = string.Empty;

        [JsonPropertyName("hay_penaltis")]
        public string HasPenalties { get; set; } = string.Empty;

        [JsonPropertyName("penaltis_casa")]
        public string HomePenalties { get; set; } = string.Empty;

        [JsonPropertyName("penaltis_fuera")]
        public string AwayPenalties { get; set; } = string.Empty;

        [JsonPropertyName("suspendido")]
        public string Suspended { get; set; } = string.Empty;

        [JsonPropertyName("codacta_origen")]
        public string OriginalRecordCode { get; set; } = string.Empty;

        // ----- GOALS -----
        [JsonPropertyName("goles_penalti")]
        public List<PenaltyGoal> PenaltyGoals { get; set; } = new();

        [JsonPropertyName("goles_equipo_local")]
        public List<Goal> LocalGoalsList { get; set; } = new();

        [JsonPropertyName("goles_equipo_visitante")]
        public List<Goal> AwayGoalsList { get; set; } = new();

        // ----- STAFF -----
        [JsonPropertyName("foto_delegadocampo")]
        public string FieldDelegatePhoto { get; set; } = string.Empty;

        [JsonPropertyName("delegadocampo")]
        public string FieldDelegate { get; set; } = string.Empty;

        [JsonPropertyName("foto_delegadolocal")]
        public string LocalDelegatePhoto { get; set; } = string.Empty;

        [JsonPropertyName("delegadolocal")]
        public string LocalDelegate { get; set; } = string.Empty;

        [JsonPropertyName("foto_entrenador_local")]
        public string LocalCoachPhoto { get; set; } = string.Empty;

        [JsonPropertyName("cod_entrenador_local")]
        public string LocalCoachCode { get; set; } = string.Empty;

        [JsonPropertyName("entrenador_local")]
        public string LocalCoach { get; set; } = string.Empty;

        [JsonPropertyName("foto_entrenador2_local")]
        public string LocalCoach2Photo { get; set; } = string.Empty;

        [JsonPropertyName("cod_entrenador2_local")]
        public string LocalCoach2Code { get; set; } = string.Empty;

        [JsonPropertyName("entrenador2_local")]
        public string LocalCoach2 { get; set; } = string.Empty;

        [JsonPropertyName("otros_tecnicos_local")]
        public List<OtherCoach> OtherLocalCoaches { get; set; } = new();

        // ----- LINEUPS LOCAL -----
        [JsonPropertyName("jugadores_equipo_local")]
        public List<LineupPlayer> LocalPlayers { get; set; } = new();

        // ----- VISITOR STAFF -----
        [JsonPropertyName("foto_delegado_visitante")]
        public string AwayDelegatePhoto { get; set; } = string.Empty;

        [JsonPropertyName("delegado_visitante")]
        public string AwayDelegate { get; set; } = string.Empty;

        [JsonPropertyName("foto_entrenador_visitante")]
        public string AwayCoachPhoto { get; set; } = string.Empty;

        [JsonPropertyName("cod_entrenador_visitante")]
        public string AwayCoachCode { get; set; } = string.Empty;

        [JsonPropertyName("entrenador_visitante")]
        public string AwayCoach { get; set; } = string.Empty;

        [JsonPropertyName("foto_entrenador_visitante2")]
        public string AwayCoach2Photo { get; set; } = string.Empty;

        [JsonPropertyName("cod_entrenador_visitante2")]
        public string AwayCoach2Code { get; set; } = string.Empty;

        [JsonPropertyName("entrenador2_visitante")]
        public string AwayCoach2 { get; set; } = string.Empty;

        [JsonPropertyName("otros_tecnicos_visitante")]
        public List<OtherCoach> OtherAwayCoaches { get; set; } = new();

        // ----- LINEUPS VISITOR -----
        [JsonPropertyName("jugadores_equipo_visitante")]
        public List<LineupPlayer> AwayPlayers { get; set; } = new();

        // ----- SUBSTITUTIONS -----
        [JsonPropertyName("sustituciones_equipo_local")]
        public List<Substitution> LocalSubstitutions { get; set; } = new();

        [JsonPropertyName("sustituciones_equipo_visitante")]
        public List<Substitution> AwaySubstitutions { get; set; } = new();

        // ----- CARDS -----
        [JsonPropertyName("tarjetas_equipo_local")]
        public List<Card> LocalCards { get; set; } = new();

        [JsonPropertyName("tarjetas_equipo_visitante")]
        public List<Card> AwayCards { get; set; } = new();

        [JsonPropertyName("otras_tarjetas")]
        public List<Card> OtherCards { get; set; } = new();

        // ----- REFEREES -----
        [JsonPropertyName("arbitros_partido")]
        public List<Referee> Referees { get; set; } = new();
    }


    // =======================================================
    // SUB-ENTITIES
    // =======================================================

    public class Goal
    {
        [JsonPropertyName("codjugador")]
        public string PlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jugador")]
        public string PlayerName { get; set; } = string.Empty;

        [JsonPropertyName("minuto")]
        public string Minute { get; set; } = string.Empty;

        [JsonPropertyName("tipo_gol")]
        public string GoalType { get; set; } = string.Empty;
    }

    public class PenaltyGoal
    {
        // The JSON structure is empty, so no fields for now.
    }

    public class OtherCoach
    {
        [JsonPropertyName("foto")]
        public string Photo { get; set; } = string.Empty;

        [JsonPropertyName("tipo")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("cod_tecnico")]
        public string CoachCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")]
        public string Name { get; set; } = string.Empty;
    }

    public class LineupPlayer
    {
        [JsonPropertyName("codjugador")]
        public string PlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("foto")]
        public string Photo { get; set; } = string.Empty;

        [JsonPropertyName("dorsal")]
        public string Number { get; set; } = string.Empty;

        [JsonPropertyName("sexo")]
        public string Gender { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jugador")]
        public string PlayerName { get; set; } = string.Empty;

        [JsonPropertyName("titular")]
        public string Starter { get; set; } = string.Empty;

        [JsonPropertyName("suplente")]
        public string Substitute { get; set; } = string.Empty;

        [JsonPropertyName("capitan")]
        public string Captain { get; set; } = string.Empty;

        [JsonPropertyName("portero")]
        public string Goalkeeper { get; set; } = string.Empty;

        [JsonPropertyName("posicion")]
        public string Position { get; set; } = string.Empty;

        [JsonPropertyName("posicion_jugador_abreviatura")]
        public string PositionAbbreviation { get; set; } = string.Empty;

        [JsonPropertyName("ver_estadisiticas_jugador")]
        public string ShowStats { get; set; } = string.Empty;
    }

    public class Substitution
    {
        [JsonPropertyName("minuto")]
        public string Minute { get; set; } = string.Empty;

        [JsonPropertyName("entradorsal")]
        public string EnteringNumber { get; set; } = string.Empty;

        [JsonPropertyName("codjugador_entra")]
        public string EnteringPlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jugador_entra")]
        public string EnteringPlayerName { get; set; } = string.Empty;

        [JsonPropertyName("saledorsal")]
        public string ExitingNumber { get; set; } = string.Empty;

        [JsonPropertyName("codjugador_sale")]
        public string ExitingPlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jugador_sale")]
        public string ExitingPlayerName { get; set; } = string.Empty;
    }

    public class Card
    {
        [JsonPropertyName("codigo_tipo_amonestacion")]
        public string CardType { get; set; } = string.Empty;

        [JsonPropertyName("codjugador")]
        public string PlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("segunda_amarilla")]
        public string SecondYellow { get; set; } = string.Empty;

        [JsonPropertyName("minuto")]
        public string Minute { get; set; } = string.Empty;

        [JsonPropertyName("nombre_jugador")]
        public string PlayerName { get; set; } = string.Empty;
    }

    public class Referee
    {
        [JsonPropertyName("cod_arbitro")]
        public string RefereeCode { get; set; } = string.Empty;

        [JsonPropertyName("tipo_arbitro")]
        public string RefereeType { get; set; } = string.Empty;

        [JsonPropertyName("nombre_arbitro")]
        public string RefereeName { get; set; } = string.Empty;
    }

}
