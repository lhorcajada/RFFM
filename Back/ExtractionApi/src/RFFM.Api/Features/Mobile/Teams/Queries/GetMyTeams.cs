using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Teams.Queries
{
    public class GetMyTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/mobile/me/teams",
                    async (IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(new GetMyTeamsQuery(), ct))
                .WithName(nameof(GetMyTeams))
                .WithTags("Teams")
                .Produces<List<TeamDto>>(StatusCodes.Status200OK);
        }

        public record GetMyTeamsQuery : IRequest<IEnumerable<TeamDto>>;

        public record TeamDto(string TeamId, string TeamName, int RoleId, string? LinkedTeamPlayerId);

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<GetMyTeamsQuery, IEnumerable<TeamDto>>
        {
            public async ValueTask<IEnumerable<TeamDto>> Handle(GetMyTeamsQuery request, CancellationToken cancellationToken)
            {
                var teams = await db.Set<UserTeam>()
                    .AsNoTracking()
                    .Where(ut => ut.ApplicationUserId == currentUser.UserId)
                    .Join(
                        db.Set<Team>().AsNoTracking(),
                        ut => ut.TeamId,
                        t => t.Id,
                        (ut, t) => new TeamDto(
                            ut.TeamId,
                            t.Name,
                            ut.RoleId,
                            ut.LinkedTeamPlayerId
                        ))
                    .ToListAsync(cancellationToken);

                return teams;
            }
        }
    }
}
