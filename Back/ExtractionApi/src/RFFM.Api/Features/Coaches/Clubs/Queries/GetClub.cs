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
    public class GetClub : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/club/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetClubQueryApp
                        {
                            ClubId = id

                        };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetClub))
                .WithTags(ClubConstants.ClubFeature)
                .Produces<GetClubResponse>();
        }

        public record GetClubQueryApp : Common.IQueryApp<GetClubResponse>, ICacheRequest
        {
            public string ClubId { get; set; }
            public string CacheKey => ClubConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record GetClubResponse(string Id, string Name, CountriesResponse Country, string? EmblemUrl,  string? invitationCode);

        public class ClubsRequestHandler : IRequestHandler<GetClubQueryApp, GetClubResponse>
        {
            private readonly AppDbContext _db;

            public ClubsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<GetClubResponse> Handle(GetClubQueryApp request, CancellationToken cancellationToken = default)
            {
                var club = await _db.Clubs
                    .Include(c => c.Country)
                    .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken);
                if (club == null)
                    throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

                return new GetClubResponse(club.Id, club.Name,
                    new CountriesResponse(club.CountryId, club.Country.Name, club.Country.Code),
                    club.ShieldUrl, club.InvitationCode);


            }
        }
    }
}
