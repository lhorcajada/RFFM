using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Permissions
{
    public class GetMyPermissions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/permissions/me", async (HttpContext httpContext, IMediator mediator) =>
                {
                    var userId = httpContext.User.Claims.FirstOrDefault(c =>
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" ||
                        c.Type == "sub")?.Value;

                    if (string.IsNullOrEmpty(userId))
                        return Results.Unauthorized();

                    var result = await mediator.Send(new GetMyPermissionsQuery(userId));
                    return Results.Ok(result);
                })
                .WithName(nameof(GetMyPermissions))
                .WithTags("Permissions")
                .Produces<MyPermissionsResponse>()
                .RequireAuthorization();
        }

        public record GetMyPermissionsQuery(string UserId) : IQueryApp<MyPermissionsResponse>;

        public record FeaturePermissionDto(
            string FeatureName,
            string FeatureRoute,
            string PermissionType);

        public record PagePermissionDto(
            string PageIdentifier,
            string PermissionKey,
            string PermissionType);

        public record MyPermissionsResponse(
            IEnumerable<string> Roles,
            IEnumerable<FeaturePermissionDto> FeaturePermissions,
            IEnumerable<PagePermissionDto> PagePermissions);

        public class GetMyPermissionsHandler : IRequestHandler<GetMyPermissionsQuery, MyPermissionsResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public GetMyPermissionsHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<MyPermissionsResponse> Handle(
                GetMyPermissionsQuery request,
                CancellationToken cancellationToken = default)
            {
                var roles = (_currentUser.Roles ?? [])
                    .Where(r => !string.IsNullOrEmpty(r))
                    .Distinct()
                    .ToArray();

                var featurePerms = await _db.FeaturePermissions
                    .AsNoTracking()
                    .Where(fp => roles.Contains(fp.RoleName))
                    .Select(fp => new FeaturePermissionDto(
                        fp.FeatureName,
                        fp.FeatureRoute,
                        fp.PermissionTypeId == 1 ? "Read"
                            : fp.PermissionTypeId == 2 ? "Write"
                            : "ReadWrite"))
                    .ToListAsync(cancellationToken);

                var pagePerms = await _db.PagePermissions
                    .AsNoTracking()
                    .Where(pp => roles.Contains(pp.RoleName))
                    .Select(pp => new PagePermissionDto(
                        pp.PageIdentifier,
                        pp.PermissionKey,
                        pp.PermissionTypeId == 1 ? "Read"
                            : pp.PermissionTypeId == 2 ? "Write"
                            : "ReadWrite"))
                    .ToListAsync(cancellationToken);

                return new MyPermissionsResponse(roles, featurePerms, pagePerms);
            }
        }
    }
}
