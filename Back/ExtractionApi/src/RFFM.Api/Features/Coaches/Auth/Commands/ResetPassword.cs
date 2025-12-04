using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Auth.Commands;

public class ResetPassword : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("api/reset-password",
                async (ResetPasswordCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                {
                    var result = await mediator.Send(command, cancellationToken);
                    return Results.Ok(result);
                })
            .WithName(nameof(ResetPassword))
            .WithTags(AuthConstants.AuthFeature)
            .Produces(StatusCodes.Status200OK)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
    }
}

public record ResetPasswordCommand(string Token, string NewPassword) : IRequest<IResult>;

public class ResetPasswordHandler : IRequestHandler<ResetPasswordCommand, IResult>
{
    private readonly UserManager<IdentityUser> _userManager;

    public ResetPasswordHandler(UserManager<IdentityUser> userManager)
    {
        _userManager = userManager;
    }

    public async ValueTask<IResult> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.Token);
        if (user == null)
        {
            return Results.BadRequest("Token inválido o expirado.");
        }

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);

        if (!result.Succeeded)
        {
            return Results.BadRequest("Error al restablecer la contraseña.");
        }

        return Results.Ok("Contraseña actualizada correctamente.");
    }
}