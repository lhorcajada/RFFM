using Microsoft.AspNetCore.Routing;

namespace RFFM.Api.FeatureModules;

public interface IFeatureModule
{
    void AddRoutes(IEndpointRouteBuilder app);
}
