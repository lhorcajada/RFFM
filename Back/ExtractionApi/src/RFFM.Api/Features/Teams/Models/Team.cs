using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Teams.Models
{
    public class Team
    {
        [JsonPropertyName("estado")] public string Status { get; set; } = string.Empty;

        [JsonPropertyName("sesion_ok")] public string SessionOk { get; set; } = string.Empty;

        [JsonPropertyName("codigo_equipo")] public string TeamCode { get; set; } = string.Empty;

        [JsonPropertyName("codigo_club")] public string ClubCode { get; set; } = string.Empty;

        [JsonPropertyName("clave_acceso")] public string AccessKey { get; set; } = string.Empty;

        [JsonPropertyName("nombre_equipo")] public string TeamName { get; set; } = string.Empty;

        [JsonPropertyName("escudo_club")] public string ClubShield { get; set; } = string.Empty;

        [JsonPropertyName("nombre_club")] public string ClubName { get; set; } = string.Empty;

        [JsonPropertyName("categoria")] public string Category { get; set; } = string.Empty;

        [JsonPropertyName("codigo_categoria")] public string CategoryCode { get; set; } = string.Empty;

        [JsonPropertyName("portal_web")] public string Website { get; set; } = string.Empty;

        [JsonPropertyName("codigo_campo")] public string FieldCode { get; set; } = string.Empty;

        [JsonPropertyName("campo")] public string Field { get; set; } = string.Empty;

        [JsonPropertyName("foto_campo")] public string FieldPhoto { get; set; } = string.Empty;

        [JsonPropertyName("campo_entrenamiento")]
        public string TrainingField { get; set; } = string.Empty;

        [JsonPropertyName("titular_correspondencia")]
        public string CorrespondenceHolder { get; set; } = string.Empty;

        [JsonPropertyName("tratamiento_correspondencia")]
        public string CorrespondenceTitle { get; set; } = string.Empty;

        [JsonPropertyName("domicilio_correspondencia")]
        public string CorrespondenceAddress { get; set; } = string.Empty;

        [JsonPropertyName("localidad_correspondencia")]
        public string CorrespondenceCity { get; set; } = string.Empty;

        [JsonPropertyName("provincia_correspondencia")]
        public string CorrespondenceProvince { get; set; } = string.Empty;

        [JsonPropertyName("codigo_postal_correspondencia")]
        public string CorrespondencePostalCode { get; set; } = string.Empty;

        [JsonPropertyName("email_correspondencia")]
        public string CorrespondenceEmail { get; set; } = string.Empty;

        [JsonPropertyName("telefonos")] public string Phones { get; set; } = string.Empty;

        [JsonPropertyName("jugar_dia")] public string PlayDay { get; set; } = string.Empty;

        [JsonPropertyName("jugar_horario")] public string PlaySchedule { get; set; } = string.Empty;

        [JsonPropertyName("fax")] public string Fax { get; set; } = string.Empty;

        [JsonPropertyName("delegados_equipo")] public List<TeamDelegate> Delegates { get; set; } = [];

        [JsonPropertyName("auxiliares_equipo")]
        public List<TeamAssistant> Assistants { get; set; } = [];

        [JsonPropertyName("tecnicos_equipo")] public List<TeamCoach> Coaches { get; set; } = [];

        [JsonPropertyName("jugadores_equipo")] public List<TeamPlayer> Players { get; set; } = [];

    }

    public class TeamDelegate
    {
        [JsonPropertyName("cod_delegado")] public string DelegateCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")] public string Name { get; set; } = string.Empty;
    }

    public class TeamAssistant
    {
        [JsonPropertyName("cod_auxiliar")] public string AssistantCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")] public string Name { get; set; } = string.Empty;
    }

    public class TeamCoach
    {
        [JsonPropertyName("cod_tecnico")] public string CoachCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")] public string Name { get; set; } = string.Empty;
    }

    public class TeamPlayer
    {
        [JsonPropertyName("cod_jugador")] public string PlayerCode { get; set; } = string.Empty;

        [JsonPropertyName("nombre")] public string Name { get; set; } = string.Empty;
    }
}
