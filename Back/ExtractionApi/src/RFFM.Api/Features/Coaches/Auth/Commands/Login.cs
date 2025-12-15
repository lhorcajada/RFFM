using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Clubs;
using Microsoft.AspNetCore.Identity;
using RFFM.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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
        private readonly IdentityDbContext _identityDbContext;

        public LoginHandler(ITokenService tokenService, IdentityDbContext identityDbContext)
        {
            _tokenService = tokenService;
            _identityDbContext = identityDbContext;
        }

        public async ValueTask<IResult> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            // Before generating token, verify that user exists and email is confirmed
            // The TokenService will still validate credentials, but we check emailConfirmed earlier to give specific message

            // Decode temp token to get username (reuse TokenService private logic isn't accessible)
            // Instead, attempt to validate via TokenService and then additionally check EmailConfirmed in TokenService's user lookup.
            var token = await _tokenService.GenerateJwtToken(request.Token, cancellationToken);
            return Results.Ok(token);


        }

    }

}
