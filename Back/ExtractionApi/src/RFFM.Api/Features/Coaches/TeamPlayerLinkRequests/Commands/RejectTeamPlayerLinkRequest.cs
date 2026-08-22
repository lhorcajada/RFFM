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
    public class RejectTeamPlayerLinkRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/team-player-link-requests/{requestId}/reject",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new RejectTeamPlayerLinkRequestCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(RejectTeamPlayerLinkRequest))
                .WithTags("TeamPlayerLinkRequestsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class RejectTeamPlayerLinkRequestCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests;
        public string RequiredPermission => "ReadWrite";
    }

    public class RejectTeamPlayerLinkRequestHandler : IRequestHandler<RejectTeamPlayerLinkRequestCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly EmailService _emailService;
        private readonly ILogger<RejectTeamPlayerLinkRequestHandler> _logger;

        public RejectTeamPlayerLinkRequestHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager, EmailService emailService,
            ILogger<RejectTeamPlayerLinkRequestHandler> logger)
        {
            _db = db;
            _scopeAuth = scopeAuth;
            _userManager = userManager;
            _emailService = emailService;
            _logger = logger;
        }

        public async ValueTask<IResult> Handle(RejectTeamPlayerLinkRequestCommand request, CancellationToken cancellationToken)
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

            linkRequest.Reject(request.CallerUserId);
            await _db.SaveChangesAsync(cancellationToken);

            try
            {
                var applicant = await _userManager.FindByIdAsync(linkRequest.ApplicationUserId);
                var teamPlayer = await _db.TeamPlayers.AsNoTracking()
                    .Include(tp => tp.Player)
                    .FirstOrDefaultAsync(tp => tp.Id == linkRequest.TeamPlayerId, cancellationToken);
                if (applicant?.Email is not null && teamPlayer is not null)
                {
                    var playerName = $"{teamPlayer.Player.Name} {teamPlayer.Player.LastName}".Trim();
                    await _emailService.SendEmailAsync(applicant.Email, "Solicitud de vinculación rechazada - Futbol Base", "TeamPlayerLinkRejectedTemplate",
                        new Dictionary<string, string>
                        {
                            ["UserName"] = applicant.UserName ?? string.Empty,
                            ["PlayerName"] = playerName
                        });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "RejectTeamPlayerLinkRequest: could not send rejection email for request {RequestId}", linkRequest.Id);
            }

            return Results.Ok();
        }
    }
}
