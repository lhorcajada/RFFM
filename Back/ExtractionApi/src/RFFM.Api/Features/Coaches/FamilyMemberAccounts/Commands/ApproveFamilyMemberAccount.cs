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
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.FamilyMemberAccounts.Commands
{
    public class ApproveFamilyMemberAccount : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/family-members/account-requests/{requestId}/approve",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new ApproveFamilyMemberAccountCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(ApproveFamilyMemberAccount))
                .WithTags("FamilyMemberAccountsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class ApproveFamilyMemberAccountCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Squad;
        public string RequiredPermission => "ReadWrite";
    }

    public class ApproveFamilyMemberAccountHandler : IRequestHandler<ApproveFamilyMemberAccountCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<ApproveFamilyMemberAccountHandler> _logger;

        public ApproveFamilyMemberAccountHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager,
            ILogger<ApproveFamilyMemberAccountHandler> logger)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(ApproveFamilyMemberAccountCommand request, CancellationToken cancellationToken)
        {
            var accountRequest = await _db.FamilyMemberAccountRequests
                .Include(r => r.TeamPlayerFamilyMember)
                .Include(r => r.TeamPlayer)
                .FirstOrDefaultAsync(r => r.Id == request.RequestId, cancellationToken);

            if (accountRequest is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Solicitud no encontrada",
                    Detail = "No existe la solicitud indicada.",
                    Extensions = { ["code"] = ErrorCodes.FamilyMemberAccountRequestNotFound }
                });
            }

            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, accountRequest.TeamPlayer.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            if (accountRequest.Status != FamilyMemberAccountRequestStatus.Pending)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Solicitud ya decidida",
                    Detail = "La solicitud ya fue procesada.",
                    Extensions = { ["code"] = ErrorCodes.FamilyMemberAccountRequestAlreadyDecided }
                });
            }

            var teamId = accountRequest.TeamPlayer.TeamId;
            var applicationUserId = accountRequest.ApplicationUserId;
            var teamPlayerId = accountRequest.TeamPlayerId;

            // NOTE on atomicity: see CreateUser.cs / ClubJoinRequestApprovalService for the full
            // explanation. Identity role assignment stays a best-effort step outside the
            // AppDbContext transaction.
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                _db.ChangeTracker.Clear();
                _db.FamilyMemberAccountRequests.Attach(accountRequest);
                _db.TeamPlayerFamilyMembers.Attach(accountRequest.TeamPlayerFamilyMember);

                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                accountRequest.Approve(request.CallerUserId);

                var userTeam = new UserTeam(applicationUserId, teamId, Membership.FamilyPlayer.Id);
                userTeam.LinkPlayer(teamPlayerId);
                _db.UserTeams.Add(userTeam);

                accountRequest.TeamPlayerFamilyMember.LinkAccount(applicationUserId);

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });

            await EnsureIdentityRoleAsync(applicationUserId);
            await ConfirmEmailAsync(applicationUserId);
            await SaveUserProfileAsync(applicationUserId, teamPlayerId, teamId, cancellationToken);

            return Results.Ok();
        }

        private async Task EnsureIdentityRoleAsync(string userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user is null) return;

                if (!await _roleManager.RoleExistsAsync(AppRoles.FamilyMember.Name))
                {
                    await _roleManager.CreateAsync(new IdentityRole(AppRoles.FamilyMember.Name));
                }
                if (!await _userManager.IsInRoleAsync(user, AppRoles.FamilyMember.Name))
                {
                    await _userManager.AddToRoleAsync(user, AppRoles.FamilyMember.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveFamilyMemberAccount: could not assign FamilyMember role to user {UserId}", userId);
            }
        }

        private async Task ConfirmEmailAsync(string userId)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user is null) return;

                user.EmailConfirmed = true;
                await _userManager.UpdateAsync(user);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveFamilyMemberAccount: could not confirm email for user {UserId}", userId);
            }
        }

        private async Task SaveUserProfileAsync(string userId, string playerId, string teamId, CancellationToken ct)
        {
            try
            {
                var existing = await _db.UserProfiles.FirstOrDefaultAsync(p => p.ApplicationUserId == userId, ct);
                if (existing is null)
                {
                    _db.UserProfiles.Add(new UserProfile(userId, AppRoles.FamilyMember.Name, playerId, teamId));
                }
                else
                {
                    existing.Update(AppRoles.FamilyMember.Name, playerId, teamId);
                }

                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveFamilyMemberAccount: could not save UserProfile for user {UserId}", userId);
            }
        }
    }
}
