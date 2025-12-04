using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Seasons.Queries
{
    public class GetActiveSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season/active",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetActiveSeasonQuery();
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetActiveSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces<GetActiveSeasonResponse>();
        }

        public record GetActiveSeasonQuery : IQueryApp<GetActiveSeasonResponse>, ICacheRequest
        {
            public string CacheKey => SeasonConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record GetActiveSeasonResponse(string Id, string Name);

        public class ActiveSeasonRequestHandler(AppDbContext db) : IRequestHandler<GetActiveSeasonQuery, GetActiveSeasonResponse>
        {
            public async ValueTask<GetActiveSeasonResponse> Handle(GetActiveSeasonQuery request, CancellationToken cancellationToken = default)
            {
                var season = await db.Seasons
                    .FirstOrDefaultAsync(c => c.IsActive, cancellationToken);
                if (season == null)
                    throw new DomainException("Active season", "There is not active season","NotActiveSeason");

                return new GetActiveSeasonResponse(season.Id, season.Name);

            }
        }
    }
}
