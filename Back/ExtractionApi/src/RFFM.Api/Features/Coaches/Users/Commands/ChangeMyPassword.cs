using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    /// <summary>
    /// Cambia la contraseña del usuario autenticado comprobando la actual.
    /// PUT /api/users/me/password
    /// </summary>
    public class ChangeMyPassword : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/users/me/password",
                    async (Command command, IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                    {
                        var userId = CurrentUser.GetId(httpContext.User);
                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(command with { UserId = userId }, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(ChangeMyPassword))
                .WithTags(UserConstants.UserFeature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record Command : IRequest
        {
            public string UserId { get; init; } = string.Empty;
            public string CurrentPassword { get; init; } = string.Empty;
            public string NewPassword { get; init; } = string.Empty;
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(x => x.CurrentPassword).NotEmpty();
                RuleFor(x => x.NewPassword)
                    .NotEmpty()
                    .NotEqual(x => x.CurrentPassword)
                    .WithMessage("La nueva contraseña debe ser distinta de la actual.");
            }
        }

        public class Handler(UserManager<IdentityUser> userManager) : IRequestHandler<Command>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await userManager.FindByIdAsync(request.UserId)
                           ?? throw new NotFoundException("Usuario no encontrado", ErrorCodes.UserNotFound);

                var currentPasswordMatches = await userManager.CheckPasswordAsync(user, request.CurrentPassword);
                if (!currentPasswordMatches)
                    throw new DomainException("ChangePassword", "La contraseña actual no es correcta.",
                        ErrorCodes.CurrentPasswordIncorrect);

                var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
                if (!result.Succeeded)
                    throw new DomainException("ChangePassword",
                        result.Errors.FirstOrDefault()?.Description ?? "No se pudo cambiar la contraseña.",
                        ErrorCodes.PasswordChangeFailed);

                return Unit.Value;
            }
        }
    }
}
