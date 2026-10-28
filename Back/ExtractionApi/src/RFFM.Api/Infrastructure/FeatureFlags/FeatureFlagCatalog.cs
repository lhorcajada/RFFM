namespace RFFM.Api.Infrastructure.FeatureFlags
{
    public sealed record FeatureFlagDefinition(string Name, bool DefaultValue, string Description);

    /// <summary>
    /// Catálogo de feature flags. Un flag nuevo se declara aquí con su valor por defecto y se activa por
    /// entorno en la sección <c>FeatureFlags</c> de la configuración (p. ej. <c>"FeatureFlags": { "Nombre": true }</c>).
    /// </summary>
    public static class FeatureFlagCatalog
    {
        public const string SectionName = "FeatureFlags";

        /// <summary>Un usuario puede tener varios boletos en la misma jornada de la quiniela del equipo.</summary>
        public const string QuinielaMultipleTickets = nameof(QuinielaMultipleTickets);

        public static readonly IReadOnlyList<FeatureFlagDefinition> All =
        [
            new(QuinielaMultipleTickets, false, "Permite crear más de un boleto por usuario en la quiniela del equipo.")
        ];
    }
}
