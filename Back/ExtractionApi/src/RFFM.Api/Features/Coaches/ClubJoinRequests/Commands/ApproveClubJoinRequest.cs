using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using RFFM.Api.Common;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.ClubJoinRequests.Commands
{
    public class ApproveClubJoinRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/club-join-requests/{requestId}/approve",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new ApproveClubJoinRequestCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(ApproveClubJoinRequest))
                .WithTags("ClubJoinRequestsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class ApproveClubJoinRequestCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.ClubRegistrations;
        public string RequiredPermission => "ReadWrite";
    }

    public class ApproveClubJoinRequestHandler : IRequestHandler<ApproveClubJoinRequestCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly IClubJoinRequestApprovalService _approvalService;
        private readonly EmailService _emailService;
        private readonly ILogger<ApproveClubJoinRequestHandler> _logger;

        public ApproveClubJoinRequestHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager,
            IClubJoinRequestApprovalService approvalService, EmailService emailService,
            ILogger<ApproveClubJoinRequestHandler> logger)
        {
            _db = db; _scopeAuth = scopeAuth; _userManager = userManager;
            _approvalService = approvalService; _emailService = emailService; _logger = logger;
        }

        public async ValueTask<IResult> Handle(ApproveClubJoinRequestCommand request, CancellationToken cancellationToken)
        {
            var joinRequest = await _db.ClubJoinRequests
                .FirstOrDefaultAsync(r => r.Id == request.RequestId, cancellationToken);
            if (joinRequest is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Solicitud no encontrada",
                    Detail = "No existe la solicitud indicada.",
                    Extensions = { ["code"] = ErrorCodes.ClubJoinRequestNotFound }
                });
            }

            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Club, joinRequest.ClubId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            if (joinRequest.Status != ClubJoinRequestStatus.Pending)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Solicitud ya decidida",
                    Detail = "La solicitud ya fue procesada.",
                    Extensions = { ["code"] = ErrorCodes.ClubJoinRequestAlreadyDecided }
                });
            }

            await _approvalService.ApproveAsync(joinRequest, request.CallerUserId, cancellationToken);

            try
            {
                var applicant = await _userManager.FindByIdAsync(joinRequest.ApplicationUserId);
                var club = await _db.Clubs.AsNoTracking().FirstOrDefaultAsync(c => c.Id == joinRequest.ClubId, cancellationToken);
                if (applicant?.Email is not null && club is not null)
                {
                    await _emailService.SendEmailAsync(applicant.Email, "Solicitud aprobada - Futbol Base", "ClubJoinApprovedTemplate",
                        new Dictionary<string, string> { ["UserName"] = applicant.UserName ?? string.Empty, ["ClubName"] = club.Name });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveClubJoinRequest: could not send approval email for request {RequestId}", joinRequest.Id);
            }

            return Results.Ok();
        }
    }
}
