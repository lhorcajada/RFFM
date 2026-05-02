using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Queries
{
    public class GetMyProfile : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/me/profile", async (IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
            {
                var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                             ?? httpContext.User.FindFirst("sub")?.Value;

                if (string.IsNullOrEmpty(userId))
                    return Results.Unauthorized();

                var result = await mediator.Send(new GetMyProfileQuery(userId), ct);
                return result is null ? Results.NoContent() : Results.Ok(result);
            })
            .WithName(nameof(GetMyProfile))
            .WithTags("Users")
            .Produces<MyProfileResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization();
        }
    }

    public record GetMyProfileQuery(string UserId) : IRequest<MyProfileResponse?>;

    public record MyProfileResponse(string RoleName, string? PlayerId, string? TeamId);

    public class GetMyProfileHandler : IRequestHandler<GetMyProfileQuery, MyProfileResponse?>
    {
        private readonly AppDbContext _db;

        public GetMyProfileHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<MyProfileResponse?> Handle(GetMyProfileQuery request, CancellationToken cancellationToken)
        {
            var profile = await _db.UserProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ApplicationUserId == request.UserId, cancellationToken);

            if (profile is null) return null;

            return new MyProfileResponse(profile.RoleName, profile.PlayerId, profile.TeamId);
        }
    }
}
