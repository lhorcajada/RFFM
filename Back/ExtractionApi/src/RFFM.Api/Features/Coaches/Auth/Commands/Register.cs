using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Resources;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Auth.Commands
{
    public class Register : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/register",
                    async (RegisterCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(Register))
                .WithTags(AuthConstants.AuthFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public record RegisterCommand(string Token) : IRequest<IResult>;

    public class RegisterHandler : IRequestHandler<RegisterCommand, IResult>
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly IdentityDbContext _applicationDbContext;
        private readonly IConfiguration _configuration;

        public RegisterHandler(UserManager<IdentityUser> userManager, 
            ITokenService tokenService, 
            IdentityDbContext applicationDbContext, 
            IConfiguration configuration)
        {
            _userManager = userManager;
            _applicationDbContext = applicationDbContext;
            _configuration = configuration;
        }

        public async ValueTask<IResult> Handle(RegisterCommand request, CancellationToken cancellationToken)
        {
            var strategy = _applicationDbContext.Database.CreateExecutionStrategy();

            return await strategy.ExecuteAsync(
                _applicationDbContext,
                async (dbContext, state, ct) =>
                {
                    await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

                    try
                    {
                        var tempSecret = _configuration["Authentication:FrontendSecret"];
                        if (string.IsNullOrEmpty(tempSecret))
                        {
                            throw new DomainException("Registering", CodeMessages.RegisterSecretNotFound.Code,
                                CodeMessages.RegisterSecretNotFound.Message);

                        }
                        var tokenHandler = new JwtSecurityTokenHandler();
                        var validationParameters = new TokenValidationParameters
                        {
                            ValidateIssuerSigningKey = true,
                            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tempSecret)),
                            ValidateIssuer = false,
                            ValidateAudience = false
                        };
                        var principal = tokenHandler.ValidateToken(request.Token, validationParameters, out _);
                        var username = principal.FindFirst("username")?.Value;
                        var password = principal.FindFirst("password")?.Value;
                        var email = principal.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")?.Value;

                        var user = new IdentityUser
                        {
                            UserName = string.IsNullOrWhiteSpace(username) ? email : username,
                            Email = email,
                        };
                        if (string.IsNullOrEmpty(password))
                        {
                            throw new DomainException("Registering", CodeMessages.RegisterPasswordNotClaim.Code,
                                CodeMessages.RegisterPasswordNotClaim.Message);

                        }
                        var identityResult = await _userManager.CreateAsync(user, password);

                        if (!identityResult.Succeeded)
                        {
                            var error = identityResult.Errors.FirstOrDefault();
                            if (error == null)
                                throw new DomainException("Registering", CodeMessages.RegisterGeneralError.Code,
                                    CodeMessages.RegisterGeneralError.Message);
                            switch (error.Code)
                            {
                                case "DuplicateEmail":
                                    throw new DomainException("Registering", CodeMessages.RegisterEmailExistsAlready.Code,
                                        CodeMessages.RegisterEmailExistsAlready.Message);
                                case "PasswordTooShort":
                                case "PasswordRequiresNonAlphanumeric":
                                    throw new DomainException("Registering", CodeMessages.RegisterPassworNotMeetRequirements.Code,
                                        CodeMessages.RegisterPassworNotMeetRequirements.Message);
                                default:
                                    throw new DomainException("Registering", CodeMessages.RegisterGeneralError.Code,
                                        CodeMessages.RegisterGeneralError.Message);
                            }
                        }

                        await transaction.CommitAsync(ct);

                        return Results.Ok();
                    }
                    catch
                    {
                        await transaction.RollbackAsync(ct);
                        throw;
                    }
                },
                null,
                cancellationToken
            );
        }

    }
}
