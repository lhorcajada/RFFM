using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.FeatureFlags;

namespace RFFM.Api.Features.Infrastructure
{
    /// <summary>
    /// Valor efectivo de cada feature flag para que el frontend decida qué mostrar.
    /// GET /api/feature-flags
    /// </summary>
    public class GetFeatureFlags : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/feature-flags", (IFeatureFlags flags) => Results.Ok(flags.GetAll()))
                .WithName(nameof(GetFeatureFlags))
                .WithTags("FeatureFlags")
                .RequireAuthorization()
                .Produces<IReadOnlyDictionary<string, bool>>(StatusCodes.Status200OK);
        }
    }
}
