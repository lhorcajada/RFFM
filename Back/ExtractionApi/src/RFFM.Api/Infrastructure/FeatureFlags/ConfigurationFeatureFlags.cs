using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace RFFM.Api.Infrastructure.FeatureFlags
{
    /// <summary>
    /// Lee los flags de la sección <c>FeatureFlags</c> en cada consulta, así un cambio de configuración
    /// (appsettings con reloadOnChange, variables de entorno del host) se aplica sin reiniciar la API.
    /// Sin valor configurado, o con un valor no booleano, se usa el valor por defecto del catálogo.
    /// </summary>
    public sealed class ConfigurationFeatureFlags(IConfiguration configuration) : IFeatureFlags
    {
        public bool IsEnabled(string name)
        {
            var definition = FeatureFlagCatalog.All.FirstOrDefault(f => f.Name == name)
                ?? throw new ArgumentException($"El feature flag '{name}' no está declarado en FeatureFlagCatalog.", nameof(name));

            var configured = configuration[$"{FeatureFlagCatalog.SectionName}:{name}"];
            return bool.TryParse(configured, out var value) ? value : definition.DefaultValue;
        }

        public IReadOnlyDictionary<string, bool> GetAll() =>
            FeatureFlagCatalog.All.ToDictionary(f => f.Name, f => IsEnabled(f.Name));
    }

    public static class FeatureFlagsServiceCollectionExtensions
    {
        public static IServiceCollection AddFeatureFlags(this IServiceCollection services) =>
            services.AddSingleton<IFeatureFlags, ConfigurationFeatureFlags>();
    }
}
