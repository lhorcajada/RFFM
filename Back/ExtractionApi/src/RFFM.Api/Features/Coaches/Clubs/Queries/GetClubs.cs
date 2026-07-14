using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.Clubs;
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
                    async (HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var isAdministrator = httpContext.User.IsInRole(AppRoles.Administrator.Name);
                        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        return await mediator.Send(
                            new ClubsQueryApp { CanViewAllInvitationCodes = isAdministrator, RequestingUserId = userId },
                            cancellationToken);
                    })
                .WithName(nameof(GetClubs))
                .WithTags(ClubConstants.ClubFeature)
                .Produces<ClubsResponse[]>();
        }

        // Ya no implementa ICacheRequest — ver design.md §4: cachear esta lista por-usuario
        // no es correcto de forma general y hoy no tiene consumidores en frontend.
        public record ClubsQueryApp : Common.IQueryApp<ClubsResponse[]>
        {
            public bool CanViewAllInvitationCodes { get; set; }
            public string? RequestingUserId { get; set; }
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
                var directorClubIds = request.CanViewAllInvitationCodes
                    ? null
                    : await ClubInvitationCodeVisibility.DirectorClubIdsAsync(_db, request.RequestingUserId, cancellationToken);

                var clubs = await _db.Clubs
                    .Include(c => c.Country)
                    .ToListAsync(cancellationToken);

                return clubs.Select(club => new ClubsResponse(
                        club.Id,
                        club.Name,
                        new CountriesResponse(club.CountryId, club.Country.Name, club.Country.Code),
                        club.ShieldUrl,
                        request.CanViewAllInvitationCodes || (directorClubIds?.Contains(club.Id) ?? false)
                            ? club.InvitationCode
                            : null))
                    .ToArray();
            }
        }
    }
}
