using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.UserClubs.Queries
{
    public class GetUserClubs : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/user-clubs",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims.FirstOrDefault(c =>
                            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }
                        return Results.Ok(await mediator.Send(new UserClubsQuery(userId), cancellationToken));
                    })
                .WithName(nameof(GetUserClubs))
                .WithTags(UserClubConstants.UserClubFeature)
                .RequireAuthorization()
                .Produces<UserClubsResponse[]>()
                .Produces(StatusCodes.Status401Unauthorized);
        }

        public record UserClubsQuery(string UserId) : IQueryApp<UserClubsResponse[]>;

        public record UserClubsResponse(string ClubId, string ClubName, string ShieldUrl, string Role, int RoleId, bool isCreator);

        public class UserClubsRequestHandler : IRequestHandler<UserClubsQuery, UserClubsResponse[]>
        {
            private readonly AppDbContext _db;

            public UserClubsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<UserClubsResponse[]> Handle(UserClubsQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.UserClubs
                    .Include(uc => uc.Club)
                    .Include(r=> r.Membership)
                    .Where(uc => uc.ApplicationUserId == request.UserId)
                    .Select(uc => new UserClubsResponse(
                        uc.Club.Id,
                        uc.Club.Name,
                        uc.Club.ShieldUrl ?? "/default-shield.png",
                        uc.Membership.Name,
                        uc.RoleId,
                        uc.IsCreator
                    ))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
