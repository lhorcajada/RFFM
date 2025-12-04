using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Countries.Queries;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClub;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class GetTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teams",
                    async (HttpContext httpContext, IMediator mediator, string clubId, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims.FirstOrDefault(c =>
                            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        return await mediator.Send(new TeamsQuery(clubId, userId), cancellationToken);
                    })
                .WithName(nameof(GetTeams))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<TeamsResponse[]>();
        }

        public record TeamsQuery(string ClubId, string UserId) : IQueryApp<TeamsResponse[]>;

        public record TeamsResponse(string Id, 
            string Name, 
            CategoryResponse Category,
            LeagueResponse League,
            GetClubResponse Club,
            string? UrlPhoto);
        public record CategoryResponse(int Id, string Name);
        public record LeagueResponse(int? Id, string? Name, int? group);

        public class TeamsRequestHandler : IRequestHandler<TeamsQuery, TeamsResponse[]>
        {
            private readonly AppDbContext _db;

            public TeamsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<TeamsResponse[]> Handle(TeamsQuery request, CancellationToken cancellationToken = default)
            {
                var userClub = await _db.UserClubs
                    .FirstOrDefaultAsync(u => 
                            u.ApplicationUserId == request.UserId 
                            && u.ClubId == request.ClubId
                        , cancellationToken);
                if (userClub == null)
                    throw new DomainException("Listado de equipos",
                        "El usuario no tiene acceso al listado de equipo del club", "");


                return await _db.Teams
                    .Include(t => t.Club)
                    .ThenInclude(c=> c.Country)
                    .Include(t=> t.Category)
                    .Include(cat=> cat!.League)
                    .Where(t=> t.ClubId == request.ClubId)
                    .Select(t=> new TeamsResponse(t.Id, t.Name, 
                        new CategoryResponse(t.CategoryId, t.Category!.Name),
                        new LeagueResponse(t.LeagueId, t.League!.Name, t.LeagueGroup),
                        new GetClubResponse(t.ClubId, 
                            t.Club.Name, new GetCountries.CountriesResponse(t.Club.CountryId, t.Club.Country.Name, t.Club.Country.Code),
                            t.Club.ShieldUrl, null), t.UrlPhoto))
                    .AsNoTracking()
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}