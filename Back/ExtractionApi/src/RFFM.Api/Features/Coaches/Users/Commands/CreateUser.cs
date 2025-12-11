using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Services.Email;
using Microsoft.Extensions.Configuration;
using RFFM.Api.Domain.Entities;

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
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly EmailService _emailService;
            private readonly IConfiguration _configuration;

            public Handler(UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager, EmailService emailService, IConfiguration configuration)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _emailService = emailService;
                _configuration = configuration;
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
                if (!result.Succeeded)
                {
                    return Results.BadRequest(result.Errors);
                }

                // Ensure default role exists and assign to user (best-effort)
                try
                {
                    var defaultRole = AppRoles.Federation.Name;
                    if (!await _roleManager.RoleExistsAsync(defaultRole))
                    {
                        await _roleManager.CreateAsync(new IdentityRole(defaultRole));
                    }
                    await _userManager.AddToRoleAsync(user, defaultRole);
                }
                catch
                {
                    // ignore role assignment failures for now
                }

                // Generate email confirmation token
                var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);

                // Build confirmation URL for admin to click
                // Prefer ApiBase for direct API confirmation links (option 1). Fallback to FrontUrlBase or relative path.
                var apiBase = _configuration["ApiBase"]?.TrimEnd('/') ?? _configuration["FrontUrlBase"]?.TrimEnd('/') ?? string.Empty;
                var confirmUrl = string.Empty;
                if (!string.IsNullOrEmpty(apiBase))
                {
                    confirmUrl = $"{apiBase}/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}";
                }
                else
                {
                    confirmUrl = $"/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}";
                }

                var placeholders = new Dictionary<string, string>
                {
                    ["UserName"] = user.UserName ?? string.Empty,
                    ["ConfirmUrl"] = confirmUrl,
                    ["UserEmail"] = user.Email ?? string.Empty
                };

                var subject = "Aprobación de nuevo usuario - Futbol Base";

                // Send email to the configured admin address (Smtp:FromEmail) so admin can approve
                var adminEmail = _configuration["Smtp:FromEmail"] ?? _configuration["Seed:AdminEmail"] ?? string.Empty;
                if (string.IsNullOrWhiteSpace(adminEmail))
                {
                    return Results.Ok("Usuario registrado exitosamente, pero no se encontró un email de administrador para notificar.");
                }

                try
                {
                    await _emailService.SendEmailAsync(adminEmail, subject, "ConfirmUserTemplate", placeholders);
                }
                catch
                {
                    // If sending fails, do not block creation but return created with warning.
                    return Results.Ok("Usuario registrado, pero no se pudo enviar el correo de notificación al administrador.");
                }

                return Results.Ok("Usuario registrado exitosamente. Se ha notificado al administrador para su aprobación.");
            }
        }
    }
}
