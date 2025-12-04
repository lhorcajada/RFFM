using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Countries.Queries;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClub;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class GetTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{id}",
                    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims.FirstOrDefault(c =>
                            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        return await mediator.Send(new TeamQuery(id, userId), cancellationToken);
                    })
                .WithName(nameof(GetTeam))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<TeamResponse>();
        }

        public record TeamQuery(string TeamId, string UserId) : IQueryApp<TeamResponse>;

        public record TeamResponse(string Id,
            string Name,
            GetTeams.CategoryResponse Category,
            GetTeams.LeagueResponse League,
            GetClubResponse Club,
            string? UrlPhoto);

        public class TeamsRequestHandler : IRequestHandler<TeamQuery, TeamResponse>
        {
            private readonly AppDbContext _db;

            public TeamsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<TeamResponse> Handle(TeamQuery request, CancellationToken cancellationToken = default)
            {
                var team = await _db.Teams
                        .Include(t => t.Club)
                        .ThenInclude(c => c.Country)
                        .Include(t => t.Category)
                        .Include(cat => cat!.League)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t =>
                        t.Id == request.TeamId,
                        cancellationToken);
                if (team == null)
                    throw new KeyNotFoundException($"Team '{request.TeamId}' Not Found");
                return new TeamResponse(team.Id, team.Name,
                    new GetTeams.CategoryResponse(team.CategoryId, team.Category.Name),
                    new GetTeams.LeagueResponse(team.League!.Id, team.League.Name, team.LeagueGroup),
                    new GetClubResponse(team.ClubId, team.Club.Name,
                        new GetCountries.CountriesResponse(team.Club.CountryId, team.Club.Country.Name, team.Club.Country.Code),
                        team.Club.ShieldUrl, null),
                    team.UrlPhoto);
            }
        }
    }
}