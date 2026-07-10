using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Auth;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class CreateUser : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/register", async (Command command, IMediator mediator, CancellationToken cancellationToken)
                    => await mediator.Send(command, cancellationToken))
                .WithName(nameof(CreateUser))
                .WithTags(UserConstants.UserFeature)
                .Produces<RegisterPayingAccountResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .AllowAnonymous();
        }

        public class Command : IInvalidateCacheRequest, IRequest<IResult>
        {
            public string Alias { get; set; } = null!;
            public string Email { get; set; } = null!;
            public string Password { get; set; } = null!;
            public string? AccountType { get; set; }
            public string PrefixCacheKey => UserConstants.CachePrefix;
        }

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly UserManager<IdentityUser> _userManager;
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly EmailService _emailService;
            private readonly IConfiguration _configuration;
            private readonly AppDbContext _db;
            private readonly ILogger<Handler> _logger;

            public Handler(UserManager<IdentityUser> userManager,
                          RoleManager<IdentityRole> roleManager,
                          EmailService emailService,
                          IConfiguration configuration,
                          AppDbContext db,
                          ILogger<Handler> logger)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _emailService = emailService;
                _configuration = configuration;
                _db = db;
                _logger = logger;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken)
            {
                var accountType = (request.AccountType ?? string.Empty).Trim();
                if (!string.Equals(accountType, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(accountType, AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(accountType, "Directive", StringComparison.OrdinalIgnoreCase))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "Tipo de cuenta requerido",
                        Detail = "Debe seleccionar accountType 'Coach' o 'Directive'."
                    });
                }

                var identityRoleName = string.Equals(accountType, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase)
                    ? AppRoles.Coach.Name
                    : AppRoles.ClubDirector.Name;

                var existsAlias = await _userManager.FindByNameAsync(request.Alias);
                if (existsAlias != null)
                {
                    return Results.Conflict(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = "Alias duplicado",
                        Detail = $"Ya existe un usuario con el alias: {request.Alias}"
                    });
                }

                var user = new IdentityUser
                {
                    Email = request.Email,
                    UserName = request.Alias
                };

                var result = await _userManager.CreateAsync(user, request.Password);
                if (!result.Succeeded)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No se pudo crear el usuario",
                        Detail = string.Join("; ", result.Errors.Select(e => e.Description))
                    });
                }

                try
                {
                    if (!await _roleManager.RoleExistsAsync(identityRoleName))
                    {
                        await _roleManager.CreateAsync(new IdentityRole(identityRoleName));
                    }
                    await _userManager.AddToRoleAsync(user, identityRoleName);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not assign Identity role {Role} to user {UserId}",
                        identityRoleName, user.Id);
                }

                var subscription = await CreateFreeTrialSubscriptionAsync(user.Id, cancellationToken);

                await SendConfirmationEmailAsync(user, cancellationToken);

                var roles = await _userManager.GetRolesAsync(user);

                return Results.Ok(new RegisterPayingAccountResponse
                {
                    UserId = user.Id,
                    Roles = roles.ToArray(),
                    Subscription = new SubscriptionDto
                    {
                        Plan = "Free",
                        Status = subscription?.Status.ToString() ?? SubscriptionStatus.Active.ToString(),
                        EndDate = subscription?.EndDate ?? DateTime.UtcNow.AddDays(7)
                    }
                });
            }

            private async Task<Subscription?> CreateFreeTrialSubscriptionAsync(string userId, CancellationToken cancellationToken)
            {
                try
                {
                    var freePlan = await _db.PaymentPlans!.FirstOrDefaultAsync(p => p.Name == "Free", cancellationToken);
                    if (freePlan == null)
                    {
                        freePlan = new PaymentPlan
                        {
                            Name = "Free",
                            Description = "7 days free trial",
                            PriceCents = 0,
                            BillingPeriod = BillingPeriodType.OneOff,
                            AllowedClubs = 1,
                            AllowedTeams = 1,
                            AllowedUsers = 1
                        };
                        _db.PaymentPlans!.Add(freePlan);
                        await _db.SaveChangesAsync(cancellationToken);
                    }

                    var now = DateTime.UtcNow;
                    var sub = new Subscription
                    {
                        UserId = userId,
                        PaymentPlanId = freePlan.Id,
                        StartDate = now,
                        EndDate = now.AddDays(7),
                        Status = SubscriptionStatus.Active,
                        CreatedAt = now
                    };
                    _db.Subscriptions!.Add(sub);
                    await _db.SaveChangesAsync(cancellationToken);
                    return sub;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: error persisting Subscription for user {UserId}", userId);
                    return null;
                }
            }

            private async Task SendConfirmationEmailAsync(IdentityUser user, CancellationToken cancellationToken)
            {
                try
                {
                    var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
                    var apiBase = _configuration["ApiBase"]?.TrimEnd('/')
                                  ?? _configuration["FrontUrlBase"]?.TrimEnd('/')
                                  ?? string.Empty;
                    var confirmUrl = !string.IsNullOrEmpty(apiBase)
                        ? $"{apiBase}/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}"
                        : $"/api/users/confirm?userId={user.Id}&token={Uri.EscapeDataString(token)}";

                    var placeholders = new Dictionary<string, string>
                    {
                        ["UserName"] = user.UserName ?? string.Empty,
                        ["ConfirmUrl"] = confirmUrl,
                        ["UserEmail"] = user.Email ?? string.Empty
                    };

                    var subject = "Aprobación de nuevo usuario - Futbol Base";
                    var adminEmail = _configuration["Smtp:FromEmail"] ?? _configuration["Seed:AdminEmail"] ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(adminEmail))
                    {
                        return;
                    }

                    await _emailService.SendEmailAsync(adminEmail, subject, "ConfirmUserTemplate", placeholders);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CreateUser: could not send confirmation email for user {UserId}", user.Id);
                }
            }
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(r => r.Alias).NotEmpty();
                RuleFor(r => r.Email).NotEmpty().EmailAddress();
                RuleFor(r => r.Password).NotEmpty();
            }
        }
    }

    public class RegisterPayingAccountResponse
    {
        public string UserId { get; set; } = string.Empty;
        public string[] Roles { get; set; } = Array.Empty<string>();
        public SubscriptionDto Subscription { get; set; } = new();
    }

    public class SubscriptionDto
    {
        public string Plan { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime EndDate { get; set; }
    }
}