using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.DependencyInjection;

public static class AddFeatureModules
{
    public static void MapFeatures(this IEndpointRouteBuilder builder)
    {
        try
        {
            // Explicitly reference the RFFM.Api assembly to ensure it's loaded
            var apiAssembly = typeof(IFeatureModule).Assembly;
            
            var featureTypes = apiAssembly
                .GetTypes()
                .Where(p => p.IsClass && !p.IsAbstract && p.IsPublic && p.IsAssignableTo(typeof(IFeatureModule)))
                .ToList();

            foreach (var featureType in featureTypes)
            {
                try
                {
                    var feature = Activator.CreateInstance(featureType) as IFeatureModule;
                    if (feature != null)
                    {
                        feature.AddRoutes(builder);
                    }
                }
                catch (Exception ex)
                {
                    // Log error but continue with other features
                    Console.WriteLine($"Error instantiating feature {featureType.Name}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error loading feature modules: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            throw;
        }
    }
}