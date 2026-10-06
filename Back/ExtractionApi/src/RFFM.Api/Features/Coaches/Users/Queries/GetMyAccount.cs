using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Users.Queries
{
    /// <summary>
    /// Cuenta del usuario autenticado: alias y email (solo lectura) más sus datos personales.
    /// GET /api/users/me/account
    /// </summary>
    public class GetMyAccount : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/me/account", async (IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                {
                    var userId = CurrentUser.GetId(httpContext.User);
                    if (string.IsNullOrEmpty(userId))
                        return Results.Unauthorized();

                    return Results.Ok(await mediator.Send(new Query(userId), ct));
                })
                .WithName(nameof(GetMyAccount))
                .WithTags(UserConstants.UserFeature)
                .Produces<MyAccountResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record Query(string UserId) : IRequest<MyAccountResponse>;

        public record MyAccountResponse(
            string Alias,
            string? Email,
            string? FirstName,
            string? LastName,
            string? SecondLastName,
            string? PhoneNumber,
            string? AvatarUrl)
        {
            public static MyAccountResponse From(IdentityUser user, UserPersonalData? data) => new(
                user.UserName ?? string.Empty,
                user.Email,
                data?.FirstName,
                data?.LastName,
                data?.SecondLastName,
                data?.PhoneNumber,
                data?.AvatarUrl);
        }

        public class Handler(AppDbContext db, UserManager<IdentityUser> userManager) : IRequestHandler<Query, MyAccountResponse>
        {
            public async ValueTask<MyAccountResponse> Handle(Query request, CancellationToken cancellationToken)
            {
                var user = await userManager.FindByIdAsync(request.UserId)
                           ?? throw new NotFoundException("Usuario no encontrado", ErrorCodes.UserNotFound);

                var data = await db.UserPersonalData
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.ApplicationUserId == request.UserId, cancellationToken);

                return MyAccountResponse.From(user, data);
            }
        }
    }
}
