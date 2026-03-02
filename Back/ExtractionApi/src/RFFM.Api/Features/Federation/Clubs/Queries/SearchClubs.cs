using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Clubs.Services;

namespace RFFM.Api.Features.Federation.Clubs.Queries
{
    public class FederationSearchClubs : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/clubs/search",
                    async (
                        IClubDirectoryService clubDirectoryService,
                        IMemoryCache cache,
                        CancellationToken cancellationToken,
                        string? search,
                        string? codclub) =>
                    {
                        var normalizedSearch = (search ?? string.Empty).Trim();
                        var normalizedCodclub = (codclub ?? string.Empty).Trim();
                        var cacheKey = $"clubs_search_{normalizedCodclub}_{normalizedSearch}";

                        var results = await cache.GetOrCreateAsync(cacheKey, async entry =>
                        {
                            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                            return await clubDirectoryService.SearchAsync(normalizedSearch, normalizedCodclub, cancellationToken);
                        });

                        return Results.Ok(results ?? Array.Empty<ClubDirectoryItem>());
                    })
                .WithName(nameof(FederationSearchClubs))
                .WithTags(ClubsConstants.ClubsFeature)
                .Produces<IReadOnlyList<ClubDirectoryItem>>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }
}
