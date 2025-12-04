using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Countries.Queries
{
    public class GetCountry : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/country/{id}",
                    async (int id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new CountryQueryApp
                        {
                            CountryId = id
                        };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetCountry))
                .WithTags(CountryConstants.CountryFeature)
                .Produces<CountryResponse>();
        }

        public record CountryQueryApp : IQueryApp<CountryResponse>, ICacheRequest
        {
            public int CountryId { get; set; }
            public string CacheKey => CountryConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record CountryResponse(int Id, string Name, string Code);

        public class CountryRequestHandler : IRequestHandler<CountryQueryApp, CountryResponse>
        {
            private readonly ReadOnlyCatalogDbContext _db;

            public CountryRequestHandler(ReadOnlyCatalogDbContext db)
            {
                _db = db;
            }

            public async ValueTask<CountryResponse> Handle(CountryQueryApp request, CancellationToken cancellationToken = default)
            {
                var country = await _db.Countries
                    .FirstOrDefaultAsync(c => c.Id == request.CountryId, cancellationToken);
                return country == null
                    ? throw new KeyNotFoundException($"Country '{request.CountryId}' Not Found")
                    : new CountryResponse(country.Id, country.Name, country.Code);
            }
        }
    }
}
