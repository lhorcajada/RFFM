namespace RFFM.Api.Infrastructure.FeatureFlags
{
    public interface IFeatureFlags
    {
        /// <exception cref="ArgumentException">El flag no está en <see cref="FeatureFlagCatalog"/>.</exception>
        bool IsEnabled(string name);

        /// <summary>Valor efectivo de cada flag del catálogo.</summary>
        IReadOnlyDictionary<string, bool> GetAll();
    }
}
