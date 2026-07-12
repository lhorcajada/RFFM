using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
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
    public class GetPendingClubJoinRequestsCount : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/clubs/{clubId}/join-requests/count",
                    async (string clubId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var query = new PendingClubJoinRequestsCountQuery
                        {
                            ClubId = clubId,
                            CallerUserId = userId
                        };
                        var result = await mediator.Send(query, cancellationToken);
                        return result;
                    })
                .WithName(nameof(GetPendingClubJoinRequestsCount))
                .WithTags("ClubJoinRequestsFeature")
                .RequireAuthorization()
                .Produces<ClubJoinRequestCountDto>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class PendingClubJoinRequestsCountQuery : IRequest<IResult>
    {
        public string ClubId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;
    }

    public class ClubJoinRequestCountDto
    {
        public int PendingCount { get; set; }
    }

    public class GetPendingClubJoinRequestsCountHandler : IRequestHandler<PendingClubJoinRequestsCountQuery, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;

        public GetPendingClubJoinRequestsCountHandler(AppDbContext db, IScopeAuthorizationService scopeAuth)
        {
            _db = db;
            _scopeAuth = scopeAuth;
        }

        public async ValueTask<IResult> Handle(PendingClubJoinRequestsCountQuery request, CancellationToken cancellationToken)
        {
            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Club, request.ClubId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var count = await _db.ClubJoinRequests
                .AsNoTracking()
                .CountAsync(r => r.ClubId == request.ClubId && r.Status == ClubJoinRequestStatus.Pending, cancellationToken);

            return Results.Ok(new ClubJoinRequestCountDto { PendingCount = count });
        }
    }
}
