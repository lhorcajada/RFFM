using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Queries
{
    public class GetTeamUsers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/coaches/team-users",
                    async (HttpContext httpContext,
                           IMediator mediator,
                           [FromQuery] string? teamId,
                           CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var query = new Query { CallerUserId = userId, TeamId = teamId ?? string.Empty };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetTeamUsers))
                .WithTags(UserConstants.UserFeature)
                .RequireAuthorization()
                .Produces<Response>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public class Query : IRequest<IResult>
        {
            public string CallerUserId { get; set; } = string.Empty;
            public string TeamId { get; set; } = string.Empty;
        }

        public class TeamUserDto
        {
            public string MembershipId { get; set; } = string.Empty;
            public string UserId { get; set; } = string.Empty;
            public string Alias { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string MembershipKind { get; set; } = string.Empty;
            public DateTime? JoinedAt { get; set; }
            public bool IsCreator { get; set; }
            public bool IsSelf { get; set; }
            public bool IsApproved { get; set; }
            public string? LinkedPlayerFullName { get; set; }
        }

        public class Response
        {
            public string TeamId { get; set; } = string.Empty;
            public string TeamName { get; set; } = string.Empty;
            public bool CallerIsCreator { get; set; }
            public List<TeamUserDto> Users { get; set; } = new();
        }

        public class Handler : IRequestHandler<Query, IResult>
        {
            private readonly AppDbContext _db;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly IScopeAuthorizationService _scopeAuth;

            public Handler(AppDbContext db, UserManager<IdentityUser> userManager, IScopeAuthorizationService scopeAuth)
            {
                _db = db;
                _userManager = userManager;
                _scopeAuth = scopeAuth;
            }

            private static readonly Dictionary<string, int> RoleOrderMap = new()
            {
                [Membership.Coach.Key] = 0,
                [Membership.Directive.Key] = 1,
                [Membership.ClubMember.Key] = 2,
                [Membership.Player.Key] = 3,
                [Membership.FamilyPlayer.Key] = 4,
                [Membership.Follower.Key] = 5
            };

            private static int RoleOrder(string membershipKind) =>
                RoleOrderMap.TryGetValue(membershipKind, out var order) ? order : int.MaxValue;

            public async ValueTask<IResult> Handle(Query request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrEmpty(request.TeamId))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "TeamId requerido",
                        Detail = "Debe indicar el equipo."
                    });
                }

                var auth = await _scopeAuth.EnsureMemberAsync(
                    request.CallerUserId, ScopeKinds.Team, request.TeamId, cancellationToken);
                if (!auth.Authorized)
                {
                    return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
                }

                var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
                if (!eviction.IsActive)
                {
                    return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
                }

                var creatorAuth = await _scopeAuth.EnsureCreatorAsync(
                    request.CallerUserId, ScopeKinds.Team, request.TeamId, cancellationToken);
                var callerIsCreator = creatorAuth.Authorized;

                var links = await _db.UserTeams
                    .AsNoTracking()
                    .Include(ut => ut.Membership)
                    .Where(ut => ut.TeamId == request.TeamId)
                    .ToListAsync(cancellationToken);

                var linkedTeamPlayerIds = links
                    .Where(ut => !string.IsNullOrEmpty(ut.LinkedTeamPlayerId))
                    .Select(ut => ut.LinkedTeamPlayerId!)
                    .Distinct()
                    .ToList();

                var linkedPlayerNames = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => linkedTeamPlayerIds.Contains(tp.Id))
                    .ToDictionaryAsync(
                        tp => tp.Id,
                        tp => $"{tp.Player.Name} {tp.Player.LastName}".Trim(),
                        cancellationToken);

                var users = new List<TeamUserDto>();
                var teamMemberUserIds = new HashSet<string>();
                foreach (var link in links)
                {
                    teamMemberUserIds.Add(link.ApplicationUserId);
                    var identityUser = await _userManager.FindByIdAsync(link.ApplicationUserId);
                    users.Add(new TeamUserDto
                    {
                        MembershipId = link.Id,
                        UserId = link.ApplicationUserId,
                        Alias = identityUser?.UserName ?? string.Empty,
                        Email = identityUser?.Email ?? string.Empty,
                        MembershipKind = link.Membership?.Key ?? string.Empty,
                        JoinedAt = link.JoinedAt,
                        IsCreator = link.IsCreator,
                        IsSelf = link.ApplicationUserId == request.CallerUserId,
                        IsApproved = identityUser?.EmailConfirmed ?? false,
                        LinkedPlayerFullName = link.LinkedTeamPlayerId is not null
                            && linkedPlayerNames.TryGetValue(link.LinkedTeamPlayerId, out var playerName)
                                ? playerName
                                : null
                    });
                }

                // Club-level members (e.g. a coach who joined via club invitation code) have no
                // UserTeam row for this specific team, but still manage it via club-wide access
                // (see TeamEditAuthorization.CanEditAsync) — they must appear here too.
                var clubOnlyLinks = await _db.UserClubs
                    .AsNoTracking()
                    .Include(uc => uc.Membership)
                    .Where(uc => uc.ClubId == auth.Scope!.ParentClubId
                        && !teamMemberUserIds.Contains(uc.ApplicationUserId))
                    .ToListAsync(cancellationToken);

                foreach (var link in clubOnlyLinks)
                {
                    var identityUser = await _userManager.FindByIdAsync(link.ApplicationUserId);
                    users.Add(new TeamUserDto
                    {
                        MembershipId = link.Id,
                        UserId = link.ApplicationUserId,
                        Alias = identityUser?.UserName ?? string.Empty,
                        Email = identityUser?.Email ?? string.Empty,
                        MembershipKind = link.Membership?.Key ?? string.Empty,
                        JoinedAt = null,
                        IsCreator = link.IsCreator,
                        IsSelf = link.ApplicationUserId == request.CallerUserId,
                        IsApproved = identityUser?.EmailConfirmed ?? false,
                        LinkedPlayerFullName = null
                    });
                }

                var orderedUsers = users
                    .OrderBy(u => RoleOrder(u.MembershipKind))
                    .ThenBy(u => u.MembershipKind == Membership.FamilyPlayer.Key
                        ? u.LinkedPlayerFullName ?? string.Empty
                        : string.Empty, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(u => u.Alias, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return Results.Ok(new Response
                {
                    TeamId = request.TeamId,
                    TeamName = auth.Scope!.Name,
                    CallerIsCreator = callerIsCreator,
                    Users = orderedUsers
                });
            }
        }
    }
}
