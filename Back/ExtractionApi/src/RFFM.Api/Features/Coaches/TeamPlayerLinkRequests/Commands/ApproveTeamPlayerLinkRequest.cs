using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.TeamPlayerLinkRequests.Commands
{
    public class ApproveTeamPlayerLinkRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/team-player-link-requests/{requestId}/approve",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new ApproveTeamPlayerLinkRequestCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(ApproveTeamPlayerLinkRequest))
                .WithTags("TeamPlayerLinkRequestsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class ApproveTeamPlayerLinkRequestCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests;
        public string RequiredPermission => "ReadWrite";
    }

    public class ApproveTeamPlayerLinkRequestHandler : IRequestHandler<ApproveTeamPlayerLinkRequestCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly EmailService _emailService;
        private readonly ILogger<ApproveTeamPlayerLinkRequestHandler> _logger;

        public ApproveTeamPlayerLinkRequestHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager,
            EmailService emailService, ILogger<ApproveTeamPlayerLinkRequestHandler> logger)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
            _roleManager = roleManager;
            _emailService = emailService;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(ApproveTeamPlayerLinkRequestCommand request, CancellationToken cancellationToken)
        {
            var linkRequest = await _db.TeamPlayerLinkRequests
                .FirstOrDefaultAsync(r => r.Id == request.RequestId, cancellationToken);
            if (linkRequest is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Solicitud no encontrada",
                    Detail = "No existe la solicitud indicada.",
                    Extensions = { ["code"] = ErrorCodes.TeamPlayerLinkRequestNotFound }
                });
            }

            var auth = await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Team, linkRequest.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            if (linkRequest.Status != TeamPlayerLinkRequestStatus.Pending)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Solicitud ya decidida",
                    Detail = "La solicitud ya fue procesada.",
                    Extensions = { ["code"] = ErrorCodes.TeamPlayerLinkRequestAlreadyDecided }
                });
            }

            var strategy = _db.Database.CreateExecutionStrategy();
            try
            {
                await strategy.ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();
                    _db.TeamPlayerLinkRequests.Attach(linkRequest);

                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    linkRequest.Approve(request.CallerUserId);
                    var userTeam = new UserTeam(linkRequest.ApplicationUserId, linkRequest.TeamId, linkRequest.MembershipId);
                    userTeam.LinkPlayer(linkRequest.TeamPlayerId);
                    _db.UserTeams.Add(userTeam);
                    await _db.SaveChangesAsync(cancellationToken);

                    await transaction.CommitAsync(cancellationToken);
                });
            }
            catch (DbUpdateException ex)
            {
                // Unique constraint violation on UserTeams for LinkedTeamPlayerId + RoleId when RoleId=4 (Player)
                _logger.LogWarning(ex, "ApproveTeamPlayerLinkRequest: concurrency conflict for request {RequestId}, player already linked", linkRequest.Id);
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Jugador ya vinculado",
                    Detail = "Este jugador ya tiene una cuenta de tipo Player vinculada.",
                    Extensions = { ["code"] = ErrorCodes.LinkedPlayerAlreadyClaimed }
                });
            }

            try
            {
                var user = await _userManager.FindByIdAsync(linkRequest.ApplicationUserId);
                if (user is not null)
                {
                    var roleName = linkRequest.MembershipId == Membership.Player.Id
                        ? AppRoles.Player.Name
                        : AppRoles.FamilyMember.Name;

                    if (!await _roleManager.RoleExistsAsync(roleName))
                        await _roleManager.CreateAsync(new IdentityRole(roleName));
                    if (!await _userManager.IsInRoleAsync(user, roleName))
                        await _userManager.AddToRoleAsync(user, roleName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveTeamPlayerLinkRequest: could not assign role for request {RequestId}", linkRequest.Id);
            }

            try
            {
                await SaveUserProfileAsync(linkRequest.ApplicationUserId,
                    linkRequest.MembershipId == Membership.Player.Id ? AppRoles.Player.Name : AppRoles.FamilyMember.Name,
                    linkRequest.TeamPlayerId, linkRequest.TeamId, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveTeamPlayerLinkRequest: could not save UserProfile for request {RequestId}", linkRequest.Id);
            }

            try
            {
                var applicant = await _userManager.FindByIdAsync(linkRequest.ApplicationUserId);
                var teamPlayer = await _db.TeamPlayers.AsNoTracking()
                    .Include(tp => tp.Player)
                    .FirstOrDefaultAsync(tp => tp.Id == linkRequest.TeamPlayerId, cancellationToken);
                if (applicant?.Email is not null && teamPlayer is not null)
                {
                    var playerName = $"{teamPlayer.Player.Name} {teamPlayer.Player.LastName}".Trim();
                    await _emailService.SendEmailAsync(applicant.Email, "Solicitud de vinculación aprobada - Futbol Base", "TeamPlayerLinkApprovedTemplate",
                        new Dictionary<string, string>
                        {
                            ["UserName"] = applicant.UserName ?? string.Empty,
                            ["PlayerName"] = playerName
                        });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveTeamPlayerLinkRequest: could not send approval email for request {RequestId}", linkRequest.Id);
            }

            return Results.Ok();
        }

        private async Task SaveUserProfileAsync(string userId, string roleName, string playerId, string teamId, CancellationToken ct)
        {
            try
            {
                var existing = await _db.UserProfiles
                    .FirstOrDefaultAsync(p => p.ApplicationUserId == userId, ct);

                if (existing is null)
                {
                    _db.UserProfiles.Add(new UserProfile(userId, roleName, playerId, teamId));
                }
                else
                {
                    existing.Update(roleName, playerId, teamId);
                }

                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveTeamPlayerLinkRequest: could not save UserProfile for user {UserId}", userId);
                throw;
            }
        }
    }
}
