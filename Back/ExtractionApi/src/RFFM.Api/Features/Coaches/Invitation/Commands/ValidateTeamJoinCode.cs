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
    public class ValidateTeamJoinCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/invitations/team/validate",
                    async (ValidateTeamInvitationRequest request,
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

                        var command = new ValidateTeamInvitationCommand
                        {
                            Code = request.Code,
                            MembershipKind = request.MembershipKind,
                            UserId = userId
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(ValidateTeamJoinCode))
                .WithTags("InvitationFeature")
                .RequireAuthorization()
                .Produces<ValidateTeamInvitationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class ValidateTeamInvitationRequest
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class ValidateTeamInvitationCommand : IRequest<IResult>
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
    }

    public class ValidateTeamInvitationResponse
    {
        public string TeamId { get; set; } = string.Empty;
        public string TeamName { get; set; } = string.Empty;
        public string ClubId { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
        public string? Token { get; set; }
    }

    public class ValidateTeamInvitationHandler : IRequestHandler<ValidateTeamInvitationCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ITokenService _tokenService;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly ILogger<ValidateTeamInvitationHandler> _logger;

        public ValidateTeamInvitationHandler(
            AppDbContext db,
            UserManager<IdentityUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ITokenService tokenService,
            IScopeAuthorizationService scopeAuth,
            ILogger<ValidateTeamInvitationHandler> logger)
        {
            _db = db;
            _userManager = userManager;
            _roleManager = roleManager;
            _tokenService = tokenService;
            _scopeAuth = scopeAuth;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(ValidateTeamInvitationCommand request, CancellationToken cancellationToken)
        {
            var membership = MembershipIdentityRoles.FromKey(request.MembershipKind);
            if (membership is null
                || membership.Key == Membership.Coach.Key
                || membership.Key == Membership.Directive.Key
                || membership.Key == Membership.ClubMember.Key)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Membership no permitida",
                    Detail = "El rol indicado no aplica a un equipo. Use Player, FamilyPlayer o Follower."
                });
            }

            var normalizedCode = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
            var team = await _db.Teams
                .FirstOrDefaultAsync(t => t.JoinCode != null
                                           && t.JoinCode.ToUpper() == normalizedCode,
                    cancellationToken);

            if (team is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Código inexistente",
                    Detail = "El código de invitación no corresponde a ningún equipo."
                });
            }

            var alreadyInTeam = await _db.UserTeams
                .AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == request.UserId && ut.TeamId == team.Id, cancellationToken);
            if (alreadyInTeam)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Ya perteneces a este equipo",
                    Detail = "Ya perteneces a este equipo."
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

            _db.UserTeams.Add(new UserTeam(
                request.UserId,
                team.Id,
                membership.Id));

            await _db.SaveChangesAsync(cancellationToken);

            await EnsureIdentityRoleAsync(request.UserId, membership, cancellationToken);

            var jwt = await TryGenerateJwtAsync(request.UserId, cancellationToken);

            return Results.Ok(new ValidateTeamInvitationResponse
            {
                TeamId = team.Id,
                TeamName = team.Name,
                ClubId = team.ClubId,
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
                _logger.LogWarning(ex, "ValidateTeamInvitation: could not assign Identity role {Role} to user {UserId}",
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
                _logger.LogWarning(ex, "ValidateTeamInvitation: could not generate JWT for user {UserId}", userId);
                return null;
            }
        }
    }

    public class ValidateTeamInvitationValidator : AbstractValidator<ValidateTeamInvitationCommand>
    {
        public ValidateTeamInvitationValidator()
        {
            RuleFor(r => r.Code).NotEmpty();
            RuleFor(r => r.MembershipKind).NotEmpty();
        }
    }
}