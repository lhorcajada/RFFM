using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Countries.Queries.GetCountries;

namespace RFFM.Api.Features.Coaches.Clubs.Queries
{
    public class GetClubs : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/clubs",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new ClubsQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetClubs))
                .WithTags(ClubConstants.ClubFeature)
                .Produces<ClubsResponse[]>();
        }

        public record ClubsQueryApp : Common.IQueryApp<ClubsResponse[]>, ICacheRequest
        {
            public string CacheKey => ClubConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record ClubsResponse(string Id, string Name, CountriesResponse Country, string? shieldUrl, string? invitationCode);

        public class ClubsRequestHandler : IRequestHandler<ClubsQueryApp, ClubsResponse[]>
        {
            private readonly AppDbContext _db;

            public ClubsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<ClubsResponse[]> Handle(ClubsQueryApp request, CancellationToken cancellationToken = default)
            {
                return await _db.Clubs
                    .Include(c=> c.Country)
                    .Select(td => new ClubsResponse(
                        td.Id, 
                        td.Name,
                        new CountriesResponse(td.CountryId, td.Country.Name, td.Country.Code), 
                        td.ShieldUrl, td.InvitationCode))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
