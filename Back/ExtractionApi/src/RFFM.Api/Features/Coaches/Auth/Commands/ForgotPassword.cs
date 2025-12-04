using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Resources;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Clubs;
using RFFM.Api.Features.Coaches.Competitions.Categories;
using RFFM.Api.Infrastructure.Services.Email;

namespace RFFM.Api.Features.Coaches.Auth.Commands
{
    public class ForgotPassword : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/forgot-password",
                    async (ForgotPasswordCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                        await mediator.Send(command, cancellationToken))
                .WithName(nameof(ForgotPassword))
                .WithTags(AuthConstants.AuthFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record ForgotPasswordCommand(string Email) : IRequest<IResult>, IInvalidateCacheRequest
    {
        public string PrefixCacheKey => AuthConstants.CachePrefix;
    }

    public class ForgotPasswordHandler : IRequestHandler<ForgotPasswordCommand, IResult>
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly EmailService _emailService;
        private readonly IConfiguration _configuration;

        public ForgotPasswordHandler(UserManager<IdentityUser> userManager, EmailService emailService, IConfiguration configuration)
        {
            _userManager = userManager;
            _emailService = emailService;
            _configuration = configuration;
        }
        public async ValueTask<IResult> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return Results.Ok("Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.");
            }

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var frontUrlBase = _configuration["FrontUrlBase"];
            var resetLink = $"{frontUrlBase}/reset-password?token={Uri.EscapeDataString(token)}";

            var placeholders = new Dictionary<string, string>
            {
                { "UserName", user.UserName },
                { "GreetingMessage", CodeMessages.ForgotPasswordGreetingMessage.Message },
                { "ActionInstructions", CodeMessages.ForgotPasswordActionInstructions.Message},
                { "ActionText", CodeMessages.ForgotPasswordActionText.Message},
                { "IgnoreMessage", CodeMessages.ForgotPasswordIgnoreMessage.Message},
                { "ExpirationMessage", CodeMessages.ForgotPasswordExpirationMessage.Message },
                { "ResetLink", resetLink }
            };

            var subject = CodeMessages.ForgotPasswordResetSubject.Message;
            await _emailService.SendEmailAsync(user.Email, subject, "PasswordResetTemplate", placeholders);

            return Results.Ok("Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.");
        }



    }


}
