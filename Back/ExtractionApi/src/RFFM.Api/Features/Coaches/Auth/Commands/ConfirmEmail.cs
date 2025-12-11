using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Auth.Commands
{
    // Minimal-api feature module for confirming user email (admin approval)
    public class ConfirmEmail : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/confirm", async (string userId, string token, UserManager<IdentityUser> userManager) =>
            {
                if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(token))
                    return Results.BadRequest("Invalid confirmation link.");

                var user = await userManager.FindByIdAsync(userId);
                if (user is null) return Results.NotFound();

                if (user.EmailConfirmed) return Results.Ok("Email already confirmed.");

                var result = await userManager.ConfirmEmailAsync(user, token);
                if (!result.Succeeded)
                {
                    return Results.BadRequest("Invalid or expired token.");
                }

                return Results.Ok("Email confirmed.");
            })
            .WithName("ConfirmUserEmail")
            .WithTags("Auth")
            .Produces(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .AllowAnonymous();
        }
    }
}
