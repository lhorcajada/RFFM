using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    public class ValidateInvitationCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/invitations/club/validate",
                    async (ValidateClubInvitationRequest request,
                           IMediator mediator,
                           HttpContext httpContext,
                           CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new ValidateClubInvitationCommand
                        {
                            Code = request.Code,
                            MembershipKind = request.MembershipKind,
                            UserId = userId
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(ValidateInvitationCode))
                .WithTags("InvitationFeature")
                .RequireAuthorization()
                .Produces<ValidateClubInvitationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class ValidateClubInvitationRequest
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class ValidateClubInvitationCommand : IRequest<IResult>
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
    }

    public class ValidateClubInvitationResponse
    {
        public string ClubId { get; set; } = string.Empty;
        public string ClubName { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
        public string? Token { get; set; }
    }

    public class ValidateClubInvitationHandler : IRequestHandler<ValidateClubInvitationCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ITokenService _tokenService;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly ILogger<ValidateClubInvitationHandler> _logger;

        public ValidateClubInvitationHandler(
            AppDbContext db,
            UserManager<IdentityUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ITokenService tokenService,
            IScopeAuthorizationService scopeAuth,
            ILogger<ValidateClubInvitationHandler> logger)
        {
            _db = db;
            _userManager = userManager;
            _roleManager = roleManager;
            _tokenService = tokenService;
            _scopeAuth = scopeAuth;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(ValidateClubInvitationCommand request, CancellationToken cancellationToken)
        {
            var membership = MembershipIdentityRoles.FromKey(request.MembershipKind);
            if (membership is null)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Membership no permitida",
                    Detail = "Rol de membership desconocido."
                });
            }

            var validation = await ClubInvitationValidation.Validate(_db, request.Code, membership, cancellationToken);
            if (!validation.Success)
            {
                return Results.Problem(
                    statusCode: validation.StatusCode,
                    title: validation.Title,
                    detail: validation.Detail,
                    extensions: new Dictionary<string, object?> { ["code"] = validation.ErrorCode });
            }

            var club = validation.Club!;

            var alreadyInClub = await _db.UserClubs
                .AsNoTracking()
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId && uc.ClubId == club.Id, cancellationToken);
            if (alreadyInClub)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Ya perteneces a este club",
                    Detail = "Ya perteneces a este club."
                });
            }

            var activeScope = await _scopeAuth.FindActiveScopeAsync(request.UserId, cancellationToken);
            if (activeScope is not null)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Ya perteneces a otro espacio",
                    Detail = "Ya perteneces a otro espacio. Abandónalo antes de unirte a uno nuevo.",
                    Extensions =
                    {
                        ["message"] = "Ya perteneces a otro espacio. Abandónalo antes de unirte a uno nuevo.",
                        ["activeScope"] = new
                        {
                            kind = activeScope.Kind,
                            id = activeScope.Id,
                            name = activeScope.Name
                        }
                    }
                });
            }

            _db.UserClubs.Add(new UserClub(
                request.UserId,
                club.Id,
                membership.Id));

            await _db.SaveChangesAsync(cancellationToken);

            await EnsureIdentityRoleAsync(request.UserId, membership, cancellationToken);

            var jwt = await TryGenerateJwtAsync(request.UserId, cancellationToken);

            return Results.Ok(new ValidateClubInvitationResponse
            {
                ClubId = club.Id,
                ClubName = club.Name,
                MembershipKind = membership.Key,
                Token = jwt
            });
        }

        private async Task EnsureIdentityRoleAsync(string userId, Membership membership, CancellationToken cancellationToken)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user is null) return;

                var roleName = MembershipIdentityRoles.ToIdentityRoleName(membership);
                if (string.IsNullOrEmpty(roleName)) return;

                if (!await _roleManager.RoleExistsAsync(roleName))
                {
                    await _roleManager.CreateAsync(new IdentityRole(roleName));
                }

                if (!await _userManager.IsInRoleAsync(user, roleName))
                {
                    await _userManager.AddToRoleAsync(user, roleName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ValidateClubInvitation: could not assign Identity role {Role} to user {UserId}",
                    membership.Key, userId);
            }
        }

        private async Task<string?> TryGenerateJwtAsync(string userId, CancellationToken cancellationToken)
        {
            try
            {
                return await _tokenService.GenerateJwtForUser(userId, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ValidateClubInvitation: could not generate JWT for user {UserId}", userId);
                return null;
            }
        }
    }

    public class ValidateClubInvitationValidator : AbstractValidator<ValidateClubInvitationCommand>
    {
        public ValidateClubInvitationValidator()
        {
            RuleFor(r => r.Code).NotEmpty();
            RuleFor(r => r.MembershipKind).NotEmpty();
        }
    }
}