using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.TeamPlayerLinkRequests.Queries
{
    public class GetTeamPlayerLinkRequests : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/teams/{teamId}/player-link-requests",
                    async (string teamId, string? status, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var query = new TeamPlayerLinkRequestsQuery
                        {
                            TeamId = teamId,
                            Status = status ?? "pending",
                            CallerUserId = userId
                        };
                        var result = await mediator.Send(query, cancellationToken);
                        return result;
                    })
                .WithName(nameof(GetTeamPlayerLinkRequests))
                .WithTags("TeamPlayerLinkRequestsFeature")
                .RequireAuthorization()
                .Produces<TeamPlayerLinkRequestDto[]>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class TeamPlayerLinkRequestsQuery : IRequest<IResult>, IRequireFeaturePermission
    {
        public string TeamId { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests;
        public string RequiredPermission => "Read";
    }

    public class TeamPlayerLinkRequestDto
    {
        public string Id { get; set; } = string.Empty;
        public string ApplicationUserId { get; set; } = string.Empty;
        public string? ApplicantAlias { get; set; }
        public string? ApplicantEmail { get; set; }
        public string TeamPlayerId { get; set; } = string.Empty;
        public string PlayerName { get; set; } = string.Empty;
        public string MembershipKey { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime RequestedAt { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecidedByAlias { get; set; }
    }

    public class GetTeamPlayerLinkRequestsHandler : IRequestHandler<TeamPlayerLinkRequestsQuery, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;

        public GetTeamPlayerLinkRequestsHandler(AppDbContext db, IScopeAuthorizationService scopeAuth, UserManager<IdentityUser> userManager)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
        }

        public async ValueTask<IResult> Handle(TeamPlayerLinkRequestsQuery request, CancellationToken cancellationToken)
        {
            var auth = await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Team, request.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var statusFilter = (request.Status ?? "pending").ToLowerInvariant();
            IQueryable<TeamPlayerLinkRequest> q = _db.TeamPlayerLinkRequests.AsNoTracking()
                .Include(r => r.TeamPlayer)
                .ThenInclude(tp => tp.Player)
                .Include(r => r.Membership)
                .Where(r => r.TeamId == request.TeamId);

            q = statusFilter switch
            {
                "decided" => q.Where(r => r.Status != TeamPlayerLinkRequestStatus.Pending),
                "all" => q,
                _ => q.Where(r => r.Status == TeamPlayerLinkRequestStatus.Pending)
            };

            var rows = await q.OrderByDescending(r => r.RequestedAt).ToArrayAsync(cancellationToken);

            var dtos = new List<TeamPlayerLinkRequestDto>(rows.Length);
            foreach (var r in rows)
            {
                var applicant = await _userManager.FindByIdAsync(r.ApplicationUserId);
                string? deciderAlias = null;
                if (!string.IsNullOrEmpty(r.DecidedByUserId))
                {
                    var decider = await _userManager.FindByIdAsync(r.DecidedByUserId);
                    deciderAlias = decider?.UserName;
                }

                dtos.Add(new TeamPlayerLinkRequestDto
                {
                    Id = r.Id,
                    ApplicationUserId = r.ApplicationUserId,
                    ApplicantAlias = applicant?.UserName,
                    ApplicantEmail = applicant?.Email,
                    TeamPlayerId = r.TeamPlayerId,
                    PlayerName = $"{r.TeamPlayer.Player.Name} {r.TeamPlayer.Player.LastName}".Trim(),
                    MembershipKey = r.Membership.Key,
                    Status = r.Status.ToString(),
                    RequestedAt = r.RequestedAt,
                    DecidedAt = r.DecidedAt,
                    DecidedByAlias = deciderAlias
                });
            }

            return Results.Ok(dtos.ToArray());
        }
    }
}
