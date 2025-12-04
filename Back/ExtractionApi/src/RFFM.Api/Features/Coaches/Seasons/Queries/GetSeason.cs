using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Seasons.Queries
{
    public class GetSeason : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/season/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetSeasonQuery
                        {
                            SeasonId = id

                        };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetSeason))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces<GetSeasonResponse>();
        }

        public record GetSeasonQuery : IQueryApp<GetSeasonResponse>, ICacheRequest
        {
            public string SeasonId { get; set; } = null!;
            public string CacheKey => SeasonConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record GetSeasonResponse(string Id, string Name);

        public class SeasonsRequestHandler(AppDbContext db) : IRequestHandler<GetSeasonQuery, GetSeasonResponse>
        {
            public async ValueTask<GetSeasonResponse> Handle(GetSeasonQuery request, CancellationToken cancellationToken = default)
            {
                var season = await db.Seasons
                    .FirstOrDefaultAsync(c => c.Id == request.SeasonId, cancellationToken);
                if (season == null)
                    throw new KeyNotFoundException($"{nameof(Season)} '{request.SeasonId}' Not Found");

                return new GetSeasonResponse(season.Id, season.Name);


            }
        }
    }
}
