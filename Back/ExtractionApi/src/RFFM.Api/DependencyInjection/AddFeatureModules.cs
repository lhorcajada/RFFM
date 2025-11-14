using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using System.Reflection;

namespace RFFM.Api.DependencyInjection;

public static class AddFeatureModules
{
    public static void MapFeatures(this IEndpointRouteBuilder builder)
    {
        // Explicitly reference the RFFM.Api assembly to ensure it's loaded
        var apiAssembly = typeof(IFeatureModule).Assembly;
        
        var features = apiAssembly
            .GetTypes()
            .Where(p => p.IsClass && !p.IsAbstract && p.IsPublic && p.IsAssignableTo(typeof(IFeatureModule)))
            .Select(Activator.CreateInstance)
            .Cast<IFeatureModule>();

        foreach (var feature in features)
        {
            feature.AddRoutes(builder);
        }
    }
}