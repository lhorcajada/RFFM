using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class CreateUser : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/register", async (Command command, IMediator mediator, CancellationToken cancellationToken)
                    => await mediator.Send(command, cancellationToken))
                .WithName(nameof(CreateUser))
                .WithTags(UserConstants.UserFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .AllowAnonymous();
        }

        public class Command : IInvalidateCacheRequest, IRequest<IResult>
        {
            public string Alias { get; set; } = null!;
            public string Email { get; set; } = null!;
            public string Password { get; set; } = null!;
            public int ClubId { get; set; }
            public string PrefixCacheKey => UserConstants.CachePrefix;
        }

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly UserManager<IdentityUser> _userManager;
            public Handler(UserManager<IdentityUser> userManager)
            {
                _userManager = userManager;
            }
            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = new IdentityUser
                {
                    Email = request.Email,
                    UserName = request.Alias,
                };
                var existsAlias = await _userManager.FindByNameAsync(request.Alias);
                if (existsAlias != null)
                {
                    return Results.BadRequest($"Ya existe un usuario que este alias: {request.Alias}");
                }
                var result = await _userManager.CreateAsync(user, request.Password);
                return !result.Succeeded ? Results.BadRequest(result.Errors) : Results.Ok("Usuario registrado exitosamente");
            }
        }
    }
}
