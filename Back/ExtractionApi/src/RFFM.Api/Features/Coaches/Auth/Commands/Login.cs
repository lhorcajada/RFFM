using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Clubs;

namespace RFFM.Api.Features.Coaches.Auth.Commands
{
    public class Login : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/login",
                    async (LoginCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                        await mediator.Send(command, cancellationToken))
                .WithName(nameof(Login))
                .WithTags(AuthConstants.AuthFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record LoginCommand(string Token) : IRequest<IResult>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => AuthConstants.CachePrefix;
    }

    public class LoginHandler : IRequestHandler<LoginCommand, IResult>
    {
        private readonly ITokenService _tokenService;

        public LoginHandler(ITokenService tokenService)
        {
            _tokenService = tokenService;
        }

        public async ValueTask<IResult> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var token = await _tokenService.GenerateJwtToken(request.Token, cancellationToken);
            return Results.Ok(token);
        }

    }

}
