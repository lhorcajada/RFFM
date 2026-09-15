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
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Invitation;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    /// <summary>
    /// Lets an already-authenticated Coach/Directive who has club-level UserClub access (but no
    /// team context yet) enter a team code and land on that team, without creating a UserTeam
    /// row -- club-level access already grants edit rights to every team in the club (see
    /// TeamEditAuthorization.CanEditAsync). See
    /// openspec/changes/coach-club-code-team-entry/design.md Decisions 1-3.
    /// </summary>
    public class EnterClubTeamAsCoach : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/invitations/team/enter-as-coach",
                    async (Request request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new Command { Code = request.Code };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(EnterClubTeamAsCoach))
                .WithTags("InvitationFeature")
                .RequireAuthorization()
                .Produces<Response>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record Request(string Code);

        public record Command : IRequest<IResult>
        {
            public string Code { get; set; } = string.Empty;
        }

        public record Response(string TeamId, string TeamName);

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly IClubJoinRequestApprovalService _approvalService;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly RoleManager<IdentityRole> _roleManager;
            private readonly ILogger<Handler> _logger;

            public Handler(
                AppDbContext db,
                ICurrentUserService currentUser,
                IClubJoinRequestApprovalService approvalService,
                UserManager<IdentityUser> userManager,
                RoleManager<IdentityRole> roleManager,
                ILogger<Handler> logger)
            {
                _db = db;
                _currentUser = currentUser;
                _approvalService = approvalService;
                _userManager = userManager;
                _roleManager = roleManager;
                _logger = logger;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId;
                if (string.IsNullOrEmpty(userId))
                {
                    return Results.Unauthorized();
                }

                var normalizedCode = request.Code.Trim().ToUpperInvariant();
                var team = await _db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.JoinCode == normalizedCode, cancellationToken);

                if (team is null)
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status404NotFound,
                        title: "Código no válido",
                        detail: "No existe ningún equipo con ese código.");
                }

                var hasClubAccess = await _db.UserClubs
                    .AsNoTracking()
                    .AnyAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId &&
                        (uc.RoleId == Membership.Coach.Id || uc.RoleId == Membership.Directive.Id),
                        cancellationToken);

                if (!hasClubAccess)
                {
                    // The applicant may not have an approved UserClub yet -- club registration
                    // (CreateUser) leaves a Pending ClubJoinRequest until a club admin approves
                    // it manually. Possessing a valid team join code for that same club is
                    // treated as proof of membership on its own: auto-approve the pending
                    // request here (same effect as ApproveClubJoinRequestHandler, decided by the
                    // applicant themselves) instead of forcing them through a separate admin
                    // approval step. See openspec/changes/coach-club-code-team-entry.
                    var pendingRequest = await _db.ClubJoinRequests
                        .FirstOrDefaultAsync(r => r.ApplicationUserId == userId && r.ClubId == team.ClubId &&
                            r.Status == ClubJoinRequestStatus.Pending &&
                            (r.MembershipId == Membership.Coach.Id || r.MembershipId == Membership.Directive.Id),
                            cancellationToken);

                    if (pendingRequest is null)
                    {
                        return Results.Problem(
                            statusCode: StatusCodes.Status403Forbidden,
                            title: "Acceso denegado",
                            detail: "Este código pertenece a un equipo de otro club.");
                    }

                    await _approvalService.ApproveAsync(pendingRequest, userId, cancellationToken);
                }

                // Repair the Identity role every time, not just when club access was newly
                // granted above: if a past AddToRoleAsync silently failed (best-effort, see
                // ClubJoinRequestApprovalService), a coach who already has UserClub access would
                // otherwise never get their Identity role back, and every protected endpoint
                // would keep failing with "No se pudo determinar el rol del usuario."
                var membershipId = await _db.UserClubs
                    .AsNoTracking()
                    .Where(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId)
                    .Select(uc => (int?)uc.RoleId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (membershipId.HasValue)
                {
                    await EnsureIdentityRoleAsync(userId, Membership.GetById(membershipId.Value), cancellationToken);
                }

                var config = await _db.Set<ConfigurationCoach>()
                    .FirstOrDefaultAsync(c => c.CoachId == userId, cancellationToken);

                if (config is null)
                {
                    _db.Add(new ConfigurationCoach
                    {
                        CoachId = userId,
                        PreferredClubId = team.ClubId,
                        PreferredTeamId = team.Id
                    });
                }
                else
                {
                    config.PreferredClubId = team.ClubId;
                    config.PreferredTeamId = team.Id;
                }

                await _db.SaveChangesAsync(cancellationToken);

                return Results.Ok(new Response(team.Id, team.Name));
            }

            private async Task EnsureIdentityRoleAsync(string userId, Membership? membership, CancellationToken cancellationToken)
            {
                var roleName = MembershipIdentityRoles.ToIdentityRoleName(membership);
                if (string.IsNullOrEmpty(roleName)) return;

                try
                {
                    var user = await _userManager.FindByIdAsync(userId);
                    if (user is null) return;

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
                    _logger.LogWarning(ex, "EnterClubTeamAsCoach: could not repair Identity role {Role} for user {UserId}",
                        roleName, userId);
                }
            }
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(r => r.Code)
                    .NotEmpty()
                    .Length(ValidationConstants.TeamJoinCodeLength)
                    .Matches("^[A-Za-z0-9]{8}$")
                    .WithMessage("El código de equipo debe tener exactamente 8 caracteres alfanuméricos.");
            }
        }
    }
}
