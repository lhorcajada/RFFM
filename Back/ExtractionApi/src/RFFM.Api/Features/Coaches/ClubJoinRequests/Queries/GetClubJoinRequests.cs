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

namespace RFFM.Api.Features.Coaches.ClubJoinRequests.Queries
{
    public class GetClubJoinRequests : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/clubs/{clubId}/join-requests",
                    async (string clubId, string? status, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var query = new ClubJoinRequestsQuery
                        {
                            ClubId = clubId,
                            Status = status ?? "pending",
                            CallerUserId = userId
                        };
                        var result = await mediator.Send(query, cancellationToken);
                        return result;
                    })
                .WithName(nameof(GetClubJoinRequests))
                .WithTags("ClubJoinRequestsFeature")
                .RequireAuthorization()
                .Produces<ClubJoinRequestDto[]>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class ClubJoinRequestsQuery : IRequest<IResult>
    {
        public string ClubId { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
        public string CallerUserId { get; set; } = string.Empty;
    }

    public class ClubJoinRequestDto
    {
        public string Id { get; set; } = string.Empty;
        public string ApplicationUserId { get; set; } = string.Empty;
        public string? ApplicantAlias { get; set; }
        public string? ApplicantEmail { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime RequestedAt { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecidedByAlias { get; set; }
    }

    public class GetClubJoinRequestsHandler : IRequestHandler<ClubJoinRequestsQuery, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;

        public GetClubJoinRequestsHandler(AppDbContext db, IScopeAuthorizationService scopeAuth, UserManager<IdentityUser> userManager)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
        }

        public async ValueTask<IResult> Handle(ClubJoinRequestsQuery request, CancellationToken cancellationToken)
        {
            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Club, request.ClubId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var statusFilter = (request.Status ?? "pending").ToLowerInvariant();
            IQueryable<ClubJoinRequest> q = _db.ClubJoinRequests.AsNoTracking()
                .Where(r => r.ClubId == request.ClubId);

            q = statusFilter switch
            {
                "decided" => q.Where(r => r.Status != ClubJoinRequestStatus.Pending),
                "all" => q,
                _ => q.Where(r => r.Status == ClubJoinRequestStatus.Pending)
            };

            var rows = await q.OrderByDescending(r => r.RequestedAt).ToArrayAsync(cancellationToken);

            var dtos = new List<ClubJoinRequestDto>(rows.Length);
            foreach (var r in rows)
            {
                var applicant = await _userManager.FindByIdAsync(r.ApplicationUserId);
                string? deciderAlias = null;
                if (!string.IsNullOrEmpty(r.DecidedByUserId))
                {
                    var decider = await _userManager.FindByIdAsync(r.DecidedByUserId);
                    deciderAlias = decider?.UserName;
                }

                dtos.Add(new ClubJoinRequestDto
                {
                    Id = r.Id,
                    ApplicationUserId = r.ApplicationUserId,
                    ApplicantAlias = applicant?.UserName,
                    ApplicantEmail = applicant?.Email,
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
