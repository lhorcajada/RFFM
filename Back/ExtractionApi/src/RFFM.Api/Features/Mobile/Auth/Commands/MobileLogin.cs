using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Auth;
using RFFM.Api.Features.Coaches.Auth.Commands;

namespace RFFM.Api.Features.Mobile.Auth.Commands
{
    public class MobileLogin : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/mobile/login",
                    async (MobileLoginCommand command, IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(command, ct))
                .WithName(nameof(MobileLogin))
                .WithTags(AuthConstants.AuthFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status401Unauthorized);
        }

        public record MobileLoginCommand(string Username, string Password) : IRequest<IResult>;

        public class MobileLoginHandler(ITokenService tokenService) : IRequestHandler<MobileLoginCommand, IResult>
        {
            public async ValueTask<IResult> Handle(MobileLoginCommand request, CancellationToken cancellationToken)
            {
                var token = await tokenService.GenerateJwtForCredentials(request.Username, request.Password, cancellationToken);
                return Results.Ok(token);
            }
        }
    }
}
