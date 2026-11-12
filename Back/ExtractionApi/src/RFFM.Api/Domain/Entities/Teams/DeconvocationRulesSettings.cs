namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Reglas de la propuesta de desconvocatoria de un equipo. Único por TeamId. Sin fila se aplica la
    /// configuración por defecto (que vive en el frontend). Las reglas se guardan como un documento JSON.
    /// </summary>
    public class DeconvocationRulesSettings : BaseEntity
    {
        public string TeamId { get; private set; } = null!;

        public string RulesJson { get; private set; } = "[]";

        public DateTime UpdatedOn { get; private set; }

        private DeconvocationRulesSettings() { }

        public static DeconvocationRulesSettings Create(string teamId, string rulesJson)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("teamId cannot be empty.", nameof(teamId));

            var settings = new DeconvocationRulesSettings { TeamId = teamId };
            settings.UpdateRules(rulesJson);
            return settings;
        }

        public void UpdateRules(string rulesJson)
        {
            RulesJson = rulesJson;
            UpdatedOn = DateTime.UtcNow;
        }
    }
}
