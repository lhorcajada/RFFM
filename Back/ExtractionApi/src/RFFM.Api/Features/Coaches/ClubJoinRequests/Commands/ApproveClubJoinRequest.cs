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

    public class ApproveClubJoinRequestCommand : IRequest<IResult>
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;
    }

    public class ApproveClubJoinRequestHandler : IRequestHandler<ApproveClubJoinRequestCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IClubSeatBillingService _billing;
        private readonly EmailService _emailService;
        private readonly ILogger<ApproveClubJoinRequestHandler> _logger;

        public ApproveClubJoinRequestHandler(
            AppDbContext db, IScopeAuthorizationService scopeAuth,
            UserManager<IdentityUser> userManager, RoleManager<IdentityRole> roleManager,
            IClubSeatBillingService billing, EmailService emailService,
            ILogger<ApproveClubJoinRequestHandler> logger)
        {
            _db = db; _scopeAuth = scopeAuth; _userManager = userManager;
            _roleManager = roleManager; _billing = billing; _emailService = emailService; _logger = logger;
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

            // NOTE on atomicity: Identity (UserManager/RoleManager) lives in a separate
            // DbContext/connection (IdentityDbContext) from the ClubJoinRequest/UserClub rows
            // (AppDbContext). A System.Transactions.TransactionScope spanning both is
            // incompatible with AppDbContext's EnableRetryOnFailure execution strategy (EF Core
            // throws as soon as any command runs under one) and never gave genuine two-connection
            // atomicity to begin with (Npgsql does not support promoting to a real distributed
            // transaction). Use the execution-strategy-aware transaction API for the AppDbContext
            // writes, and treat Identity role assignment as a best-effort step afterwards
            // (consistent with CreateUser.Handler.EnsureIdentityRoleAsync).
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                // joinRequest was already loaded/tracked above; re-attach it as Unchanged on every
                // attempt (including retries) BEFORE mutating it, so EF Core's change tracker snapshots
                // the pre-approval state and detects the mutation below as a real change. Clearing the
                // tracker (instead of just re-attaching) would make Approve()'s in-memory mutation
                // invisible to SaveChangesAsync if it ran before Attach.
                _db.ChangeTracker.Clear();
                _db.ClubJoinRequests.Attach(joinRequest);

                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                joinRequest.Approve(request.CallerUserId);
                _db.UserClubs.Add(new UserClub(joinRequest.ApplicationUserId, joinRequest.ClubId, joinRequest.MembershipId));
                await _db.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);
            });

            try
            {
                var user = await _userManager.FindByIdAsync(joinRequest.ApplicationUserId);
                if (user is not null)
                {
                    if (!await _roleManager.RoleExistsAsync(AppRoles.Coach.Name))
                        await _roleManager.CreateAsync(new IdentityRole(AppRoles.Coach.Name));
                    if (!await _userManager.IsInRoleAsync(user, AppRoles.Coach.Name))
                        await _userManager.AddToRoleAsync(user, AppRoles.Coach.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveClubJoinRequest: could not assign Coach role for request {RequestId}", joinRequest.Id);
            }

            try
            {
                await _billing.ChargeSeatAsync(joinRequest.ClubId, joinRequest.ApplicationUserId, joinRequest.MembershipId, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ApproveClubJoinRequest: billing hook failed for request {RequestId}", joinRequest.Id);
            }

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
