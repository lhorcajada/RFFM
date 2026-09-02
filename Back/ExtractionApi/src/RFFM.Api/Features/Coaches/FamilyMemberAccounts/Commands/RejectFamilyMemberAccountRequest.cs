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
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.FamilyMemberAccounts.Commands
{
    public class RejectFamilyMemberAccountRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/family-members/account-requests/{requestId}/reject",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new RejectFamilyMemberAccountRequestCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(RejectFamilyMemberAccountRequest))
                .WithTags("FamilyMemberAccountsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class RejectFamilyMemberAccountRequestCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.Squad;
        public string RequiredPermission => "ReadWrite";
    }

    public class RejectFamilyMemberAccountRequestHandler : IRequestHandler<RejectFamilyMemberAccountRequestCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly ILogger<RejectFamilyMemberAccountRequestHandler> _logger;

        public RejectFamilyMemberAccountRequestHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager,
            ILogger<RejectFamilyMemberAccountRequestHandler> logger)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(RejectFamilyMemberAccountRequestCommand request, CancellationToken cancellationToken)
        {
            var accountRequest = await _db.FamilyMemberAccountRequests
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

            // A single SaveChangesAsync() call is already atomic on its own; no explicit
            // transaction needed (see RejectClubJoinRequest.cs for the fuller explanation).
            accountRequest.Reject(request.CallerUserId);
            await _db.SaveChangesAsync(cancellationToken);

            try
            {
                var user = await _userManager.FindByIdAsync(accountRequest.ApplicationUserId);
                if (user is not null)
                {
                    await _userManager.DeleteAsync(user);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "RejectFamilyMemberAccountRequest: could not delete orphaned identity user for request {RequestId}", accountRequest.Id);
            }

            return Results.Ok();
        }
    }
}
