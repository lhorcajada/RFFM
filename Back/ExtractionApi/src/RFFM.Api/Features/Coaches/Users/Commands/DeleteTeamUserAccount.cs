using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class DeleteTeamUserAccount : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/coaches/team-users/{membershipId}",
                    async (string membershipId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new Command { CallerUserId = userId, MembershipId = membershipId };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(DeleteTeamUserAccount))
                .WithTags(UserConstants.UserFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public class Command : IRequest<IResult>
        {
            public string CallerUserId { get; set; } = string.Empty;
            public string MembershipId { get; set; } = string.Empty;
        }

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly AppDbContext _db;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly IScopeAuthorizationService _scopeAuth;
            private readonly ILogger<Handler> _logger;

            public Handler(AppDbContext db, UserManager<IdentityUser> userManager,
                IScopeAuthorizationService scopeAuth, ILogger<Handler> logger)
            {
                _db = db;
                _userManager = userManager;
                _scopeAuth = scopeAuth;
                _logger = logger;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrWhiteSpace(request.MembershipId))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "MembershipId requerido",
                        Detail = "El identificador del miembro es obligatorio."
                    });
                }

                var teamTarget = await _db.UserTeams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ut => ut.Id == request.MembershipId, cancellationToken);

                // Club-level members (e.g. a coach who joined via club invitation code) have no
                // UserTeam row — resolve them from UserClubs instead when not found above.
                var clubTarget = teamTarget is null
                    ? await _db.UserClubs
                        .AsNoTracking()
                        .FirstOrDefaultAsync(uc => uc.Id == request.MembershipId, cancellationToken)
                    : null;

                if (teamTarget is null && clubTarget is null)
                {
                    return Results.NotFound(new ProblemDetails
                    {
                        Title = "Miembro no encontrado",
                        Detail = "No se encontró el vínculo indicado."
                    });
                }

                var targetApplicationUserId = teamTarget?.ApplicationUserId ?? clubTarget!.ApplicationUserId;
                var targetIsCreator = teamTarget?.IsCreator ?? clubTarget!.IsCreator;
                var targetRoleId = teamTarget?.RoleId ?? clubTarget!.RoleId;

                if (targetApplicationUserId == request.CallerUserId)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No puedes eliminarte a ti mismo",
                        Detail = "No es posible eliminar tu propia cuenta desde esta pantalla."
                    });
                }

                if (targetIsCreator)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No se puede eliminar al creador",
                        Detail = "No es posible eliminar al creador del espacio."
                    });
                }

                var isCoachTier = targetRoleId == Membership.Coach.Id || targetRoleId == Membership.Directive.Id;

                var auth = teamTarget is not null
                    ? isCoachTier
                        ? await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, teamTarget.TeamId, cancellationToken)
                        : await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Team, teamTarget.TeamId, cancellationToken)
                    : isCoachTier
                        ? await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Club, clubTarget!.ClubId, cancellationToken)
                        : await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Club, clubTarget!.ClubId, cancellationToken);
                if (!auth.Authorized)
                {
                    var detail = isCoachTier
                        ? "Solo el creador del espacio puede eliminar a otro entrenador."
                        : auth.Detail;
                    return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: detail);
                }

                var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
                if (!eviction.IsActive)
                {
                    return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
                }

                var targetUserId = targetApplicationUserId;

                var strategy = _db.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();

                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                    var teamLinks = await _db.UserTeams
                        .Where(ut => ut.ApplicationUserId == targetUserId)
                        .ToListAsync(cancellationToken);
                    _db.UserTeams.RemoveRange(teamLinks);

                    var clubLinks = await _db.UserClubs
                        .Where(uc => uc.ApplicationUserId == targetUserId)
                        .ToListAsync(cancellationToken);
                    _db.UserClubs.RemoveRange(clubLinks);

                    var profiles = await _db.UserProfiles
                        .Where(p => p.ApplicationUserId == targetUserId)
                        .ToListAsync(cancellationToken);
                    _db.UserProfiles.RemoveRange(profiles);

                    var pushTokens = await _db.PushTokens
                        .Where(t => t.UserId == targetUserId)
                        .ToListAsync(cancellationToken);
                    _db.PushTokens.RemoveRange(pushTokens);

                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                });

                try
                {
                    var identityUser = await _userManager.FindByIdAsync(targetUserId);
                    if (identityUser is not null)
                    {
                        var deleteResult = await _userManager.DeleteAsync(identityUser);
                        if (!deleteResult.Succeeded)
                        {
                            _logger.LogWarning(
                                "Failed to delete IdentityUser {UserId} after removing app-side rows: {Errors}",
                                targetUserId, string.Join("; ", deleteResult.Errors.Select(e => e.Description)));
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete IdentityUser {UserId} after removing app-side rows.", targetUserId);
                }

                return Results.NoContent();
            }
        }
    }
}
