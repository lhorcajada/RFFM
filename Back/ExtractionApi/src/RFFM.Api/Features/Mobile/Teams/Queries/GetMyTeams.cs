using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Seasons;
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
                // Teams the user is linked to directly (Player / FamilyMember join-by-code flow).
                var directTeams = await db.Set<UserTeam>()
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

                // Teams accessible via club-level membership (Admin/Coach onboarded at club level),
                // resolved as every team of each club in its active season, mirroring GetTeams.
                var clubTeams = await db.Set<UserClub>()
                    .AsNoTracking()
                    .Where(uc => uc.ApplicationUserId == currentUser.UserId)
                    .Join(
                        db.Set<Season>().AsNoTracking().Where(s => s.IsActive),
                        uc => uc.ClubId,
                        s => s.ClubId,
                        (uc, s) => new { uc.ClubId, uc.RoleId, SeasonId = s.Id })
                    .Join(
                        db.Set<Team>().AsNoTracking(),
                        x => new { x.ClubId, x.SeasonId },
                        t => new { t.ClubId, SeasonId = t.SeasonId },
                        (x, t) => new TeamDto(
                            t.Id,
                            t.Name,
                            x.RoleId,
                            null
                        ))
                    .ToListAsync(cancellationToken);

                var teams = directTeams
                    .Concat(clubTeams.Where(ct => directTeams.All(dt => dt.TeamId != ct.TeamId)))
                    .ToList();

                return teams;
            }
        }
    }
}
