using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Scopes.Queries
{
    public class GetScopeMembers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/scopes/members",
                    async (HttpContext httpContext,
                           IMediator mediator,
                           [FromQuery] string? clubId,
                           [FromQuery] string? teamId,
                           CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var query = new ScopeMembersQuery
                        {
                            UserId = userId,
                            ClubId = clubId,
                            TeamId = teamId
                        };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetScopeMembers))
                .WithTags(ScopesConstants.ScopesFeature)
                .RequireAuthorization()
                .Produces<ScopeMember[]>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public class ScopeMembersQuery : IRequest<IResult>
        {
            public string UserId { get; set; } = string.Empty;
            public string? ClubId { get; set; }
            public string? TeamId { get; set; }
        }

        public class ScopeMember
        {
            public string MembershipId { get; set; } = string.Empty;
            public string UserId { get; set; } = string.Empty;
            public string Alias { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string MembershipKind { get; set; } = string.Empty;
            public DateTime JoinedAt { get; set; }
            public bool IsCreator { get; set; }
        }

        public class ScopeMembersHandler : IRequestHandler<ScopeMembersQuery, IResult>
        {
            private readonly AppDbContext _db;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly IScopeAuthorizationService _scopeAuth;

            public ScopeMembersHandler(AppDbContext db,
                                       UserManager<IdentityUser> userManager,
                                       IScopeAuthorizationService scopeAuth)
            {
                _db = db;
                _userManager = userManager;
                _scopeAuth = scopeAuth;
            }

            public async ValueTask<IResult> Handle(ScopeMembersQuery request, CancellationToken cancellationToken)
            {
                var scopeKind = !string.IsNullOrEmpty(request.ClubId)
                    ? ScopeKinds.Club
                    : !string.IsNullOrEmpty(request.TeamId)
                        ? ScopeKinds.Team
                        : null;
                var scopeId = scopeKind == ScopeKinds.Club ? request.ClubId : request.TeamId;

                if (scopeKind is null || string.IsNullOrEmpty(scopeId))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "Scope requerido",
                        Detail = "Debe indicar clubId o teamId."
                    });
                }

                var auth = await _scopeAuth.EnsureCreatorAsync(request.UserId, scopeKind, scopeId!, cancellationToken);
                if (!auth.Authorized)
                {
                    return Results.Problem(
                        statusCode: auth.Status,
                        title: auth.Title,
                        detail: auth.Detail);
                }

                var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
                if (!eviction.IsActive)
                {
                    return Results.Problem(
                        statusCode: eviction.Status,
                        title: eviction.Title,
                        detail: eviction.Detail);
                }

                if (scopeKind == ScopeKinds.Club)
                {
                    var links = await _db.UserClubs
                        .AsNoTracking()
                        .Include(uc => uc.Membership)
                        .Where(uc => uc.ClubId == scopeId)
                        .ToListAsync(cancellationToken);

                    var members = await BuildMembersAsync(links.Select(l => l.ApplicationUserId).Distinct().ToList(),
                        cancellationToken);

                    return Results.Ok(links.Select(l => ToScopeMember(l.Id, l.ApplicationUserId, l.Membership?.Key ?? string.Empty,
                        DateTime.UtcNow, l.IsCreator, members)).ToArray());
                }
                else
                {
                    var links = await _db.UserTeams
                        .AsNoTracking()
                        .Include(ut => ut.Membership)
                        .Where(ut => ut.TeamId == scopeId)
                        .ToListAsync(cancellationToken);

                    var members = await BuildMembersAsync(links.Select(l => l.ApplicationUserId).Distinct().ToList(),
                        cancellationToken);

                    return Results.Ok(links.Select(l => ToScopeMember(l.Id, l.ApplicationUserId, l.Membership?.Key ?? string.Empty,
                        l.JoinedAt, l.IsCreator, members)).ToArray());
                }
            }

private async Task<Dictionary<string, IdentityMember>> BuildMembersAsync(
                ICollection<string> userIds, CancellationToken cancellationToken)
            {
                var map = new Dictionary<string, IdentityMember>(StringComparer.OrdinalIgnoreCase);
                foreach (var uid in userIds.Distinct())
                {
                    var identityUser = await _userManager.FindByIdAsync(uid);
                    if (identityUser is null) continue;
                    map[uid] = new IdentityMember(identityUser.UserName ?? string.Empty, identityUser.Email ?? string.Empty);
                }
                return map;
            }

private static ScopeMember ToScopeMember(
                string membershipId,
                string userId,
                string membershipKind,
                DateTime joinedAt,
                bool isCreator,
                IReadOnlyDictionary<string, IdentityMember> members)
            {
                var identity = members.TryGetValue(userId, out var tuple) ? tuple : new IdentityMember(string.Empty, string.Empty);
                return new ScopeMember
                {
                    MembershipId = membershipId,
                    UserId = userId,
                    Alias = tuple.Alias,
                    Email = tuple.Email,
                    MembershipKind = membershipKind,
                    JoinedAt = joinedAt,
                    IsCreator = isCreator
                };
            }
        }

        public sealed record IdentityMember(string Alias, string Email);
    }
}
