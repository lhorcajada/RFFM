using Mediator;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using RFFM.Api.FeatureModules;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Queries
{
    public class GetMyRoles : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/me/roles", async (IMediator mediator, CancellationToken ct) =>
            {
                var result = await mediator.Send(new GetMyRolesQuery(), ct);
                return Results.Ok(result);
            })
            .WithName(nameof(GetMyRoles))
            .WithTags("Users")
            .Produces<string[]>(StatusCodes.Status200OK)
            .RequireAuthorization();
        }
    }

    public record GetMyRolesQuery() : IRequest<string[]>;

    public class GetMyRolesHandler : IRequestHandler<GetMyRolesQuery, string[]>
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public GetMyRolesHandler(UserManager<IdentityUser> userManager, IHttpContextAccessor httpContextAccessor)
        {
            _userManager = userManager;
            _httpContextAccessor = httpContextAccessor;
        }

        public async ValueTask<string[]> Handle(GetMyRolesQuery request, CancellationToken cancellationToken)
        {
            var httpUser = _httpContextAccessor.HttpContext?.User;
            var userId = httpUser?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? httpUser?.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId)) return Array.Empty<string>();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Array.Empty<string>();

            var roles = await _userManager.GetRolesAsync(user);
            return roles.ToArray();
        }
    }
}
