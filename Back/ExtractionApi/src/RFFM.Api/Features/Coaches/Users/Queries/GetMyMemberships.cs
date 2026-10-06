using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Users.Queries
{
    /// <summary>
    /// Clubes y equipos del usuario autenticado con su rol en cada uno.
    /// GET /api/users/me/memberships
    /// </summary>
    public class GetMyMemberships : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/me/memberships", async (IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                {
                    var userId = CurrentUser.GetId(httpContext.User);
                    if (string.IsNullOrEmpty(userId))
                        return Results.Unauthorized();

                    return Results.Ok(await mediator.Send(new Query(userId), ct));
                })
                .WithName(nameof(GetMyMemberships))
                .WithTags(UserConstants.UserFeature)
                .Produces<MyMembershipsResponse>(StatusCodes.Status200OK)
                .RequireAuthorization();
        }

        public record Query(string UserId) : IRequest<MyMembershipsResponse>;

        public record ClubMembershipResponse(string ClubId, string ClubName, string Role);

        public record TeamMembershipResponse(
            string TeamId, string TeamName, string ClubId, string ClubName, string Role, string? LinkedPlayerName);

        public record MyMembershipsResponse(
            IReadOnlyList<ClubMembershipResponse> Clubs, IReadOnlyList<TeamMembershipResponse> Teams);

        public class Handler(AppDbContext db) : IRequestHandler<Query, MyMembershipsResponse>
        {
            public async ValueTask<MyMembershipsResponse> Handle(Query request, CancellationToken cancellationToken)
            {
                var clubs = await db.UserClubs
                    .AsNoTracking()
                    .Where(uc => uc.ApplicationUserId == request.UserId)
                    .Select(uc => new { uc.ClubId, ClubName = uc.Club.Name, uc.RoleId })
                    .ToListAsync(cancellationToken);

                var teams = await db.UserTeams
                    .AsNoTracking()
                    .Where(ut => ut.ApplicationUserId == request.UserId)
                    .Select(ut => new
                    {
                        ut.TeamId,
                        TeamName = ut.Team.Name,
                        ut.Team.ClubId,
                        ClubName = ut.Team.Club.Name,
                        ut.RoleId,
                        PlayerName = ut.TeamPlayer == null ? null : ut.TeamPlayer.Player.Name,
                        PlayerLastName = ut.TeamPlayer == null ? null : ut.TeamPlayer.Player.LastName,
                    })
                    .ToListAsync(cancellationToken);

                return new MyMembershipsResponse(
                    clubs
                        .Select(c => new ClubMembershipResponse(c.ClubId, c.ClubName, RoleKey(c.RoleId)))
                        .OrderBy(c => c.ClubName)
                        .ToList(),
                    teams
                        .Select(t => new TeamMembershipResponse(t.TeamId, t.TeamName, t.ClubId, t.ClubName, RoleKey(t.RoleId),
                            PlayerFullName(t.PlayerName, t.PlayerLastName)))
                        .OrderBy(t => t.TeamName)
                        .ToList());
            }

            private static string RoleKey(int roleId) => Membership.GetById(roleId)?.Key ?? string.Empty;

            private static string? PlayerFullName(string? name, string? lastName) =>
                name is null ? null : string.Join(" ", new[] { name, lastName }.Where(p => !string.IsNullOrWhiteSpace(p)));
        }
    }
}
