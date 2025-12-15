using Mediator;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using RFFM.Api.FeatureModules;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Services;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class AcquireCoachTrial : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/coach/roles/acquire-trial",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken ct) =>
                    {
                        // The handler will fetch the current user from the User principal inside mediator handler
                        var command = new AcquireCoachTrialCommand();
                        var result = await mediator.Send(command, ct);
                        return Results.Ok(result);
                    })
                .WithName(nameof(AcquireCoachTrial))
                .WithTags("Coach")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }
    }

    public record AcquireCoachTrialCommand() : IRequest<IResult>;

    public class AcquireCoachTrialHandler : IRequestHandler<AcquireCoachTrialCommand, IResult>
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _role_manager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly AppDbContext _appDbContext;
        private readonly ITokenService _tokenService;
        private readonly ILogger<AcquireCoachTrialHandler> _logger;

        public AcquireCoachTrialHandler(UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager, IHttpContextAccessor httpContextAccessor, AppDbContext appDbContext, ITokenService tokenService, ILogger<AcquireCoachTrialHandler> logger)
        {
            _userManager = userManager;
            _role_manager = roleManager;
            _httpContextAccessor = httpContextAccessor;
            _appDbContext = appDbContext;
            _tokenService = tokenService;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(AcquireCoachTrialCommand request, CancellationToken cancellationToken)
        {
            var httpUser = _httpContextAccessor.HttpContext?.User;
            var userId = httpUser?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? httpUser?.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userId))
            {
                return Results.BadRequest(new ProblemDetails { Title = "Usuario no autenticado" });
            }

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Usuario no encontrado" });
            }

            var roleName = AppRoles.Coach.Name;
            if (!await _role_manager.RoleExistsAsync(roleName))
            {
                await _role_manager.CreateAsync(new IdentityRole(roleName));
            }

            if (await _userManager.IsInRoleAsync(user, roleName))
            {
                // Return current roles so frontend can sync
                var existingRoles = await _userManager.GetRolesAsync(user);
                // try generate token if frontend provided temp token
                var tempToken = _httpContextAccessor.HttpContext?.Request.Headers["X-Frontend-Temp-Token"].FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(tempToken))
                {
                    try
                    {
                        var jwt = await _tokenService.GenerateJwtToken(tempToken, cancellationToken);
                        _logger?.LogInformation("AcquireCoachTrial: generated JWT from temp token for user {UserId}", userId);
                        return Results.Ok(new { roles = existingRoles, token = jwt });
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "AcquireCoachTrial: failed to generate JWT from temp token for user {UserId}", userId);
                        // ignore token generation errors, return roles only
                    }
                }

                return Results.Ok(new { roles = existingRoles, token = (string?)null });
            }

            var res = await _userManager.AddToRoleAsync(user, roleName);
            if (!res.Succeeded)
            {
                return Results.Problem("No se pudo asignar el rol de Entrenador.");
            }

            // Persist a Subscription record for the free trial plan
            try
            {
                // find or create Free plan
                var freePlan = _appDbContext.PaymentPlans!.FirstOrDefault(p => p.Name == "Free");
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
                    _appDbContext.PaymentPlans!.Add(freePlan);
                    await _appDbContext.SaveChangesAsync(cancellationToken);
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
                _appDbContext.Subscriptions!.Add(sub);
                await _appDbContext.SaveChangesAsync(cancellationToken);
                _logger?.LogInformation("AcquireCoachTrial: persisted free PaymentPlan and Subscription for user {UserId}", userId);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "AcquireCoachTrial: error persisting Subscription for user {UserId}", userId);
                // swallow DB errors for now but logged
            }

            // Return updated roles for the user so frontend can synchronize immediately
            var roles = await _userManager.GetRolesAsync(user);

            // Try to generate definitive JWT for the user and return it along with roles
            try
            {
                var jwt = await _tokenService.GenerateJwtForUser(userId, cancellationToken);
                _logger?.LogInformation("AcquireCoachTrial: generated definitive JWT for user {UserId}", userId);
                return Results.Ok(new { roles = roles, token = jwt });
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "AcquireCoachTrial: failed to generate definitive JWT for user {UserId}", userId);
                // fallback: try to use frontend-provided temp token if available
                var temp = _httpContextAccessor.HttpContext?.Request.Headers["X-Frontend-Temp-Token"].FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(temp))
                {
                    try
                    {
                        var jwt = await _tokenService.GenerateJwtToken(temp, cancellationToken);
                        _logger?.LogInformation("AcquireCoachTrial: generated JWT from temp token as fallback for user {UserId}", userId);
                        return Results.Ok(new { roles = roles, token = jwt });
                    }
                    catch (Exception ex2)
                    {
                        _logger?.LogWarning(ex2, "AcquireCoachTrial: fallback temp-token generation also failed for user {UserId}", userId);
                        // ignore token errors
                    }
                }
            }

            return Results.Ok(new { roles = roles, token = (string?)null });
        }
    }
}
