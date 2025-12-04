using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Countries.Queries
{
    public class GetCountries : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/countries",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new CountriesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetCountries))
                .WithTags(CountryConstants.CountryFeature)
                .Produces<CountriesResponse[]>();
        }

        public record CountriesQueryApp : Common.IQueryApp<CountriesResponse[]>, ICacheRequest
        {
            public string CacheKey => CountryConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record CountriesResponse(int Id, string Name, string Code);

        public class CountriesRequestHandler : IRequestHandler<CountriesQueryApp, CountriesResponse[]>
        {
            private readonly ReadOnlyCatalogDbContext _db;

            public CountriesRequestHandler(ReadOnlyCatalogDbContext db)
            {
                _db = db;
            }

            public async ValueTask<CountriesResponse[]> Handle(CountriesQueryApp request, CancellationToken cancellationToken = default)
            {
                return await _db.Countries
                    .Select(td => new CountriesResponse(td.Id, td.Name, td.Code))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
