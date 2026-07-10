using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Scopes.Commands
{
    public class RegenerateInvitation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/scopes/invitations/regenerate",
                    async (RegenerateInvitationRequest request,
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

                        var command = new RegenerateInvitationCommand
                        {
                            CallerUserId = userId,
                            ScopeKind = request.ScopeKind,
                            ScopeId = request.ScopeId
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(RegenerateInvitation))
                .WithTags(ScopesConstants.ScopesFeature)
                .RequireAuthorization()
                .Produces<RegenerateInvitationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class RegenerateInvitationRequest
    {
        public string ScopeKind { get; set; } = string.Empty;
        public string ScopeId { get; set; } = string.Empty;
    }

    public class RegenerateInvitationCommand : IRequest<IResult>
    {
        public string CallerUserId { get; set; } = string.Empty;
        public string ScopeKind { get; set; } = string.Empty;
        public string ScopeId { get; set; } = string.Empty;
    }

    public class RegenerateInvitationResponse
    {
        public string ScopeKind { get; set; } = string.Empty;
        public string ScopeId { get; set; } = string.Empty;
        public string NewCode { get; set; } = string.Empty;
    }

    public class RegenerateInvitationHandler : IRequestHandler<RegenerateInvitationCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;

        public RegenerateInvitationHandler(AppDbContext db, IScopeAuthorizationService scopeAuth)
        {
            _db = db;
            _scopeAuth = scopeAuth;
        }

        public async ValueTask<IResult> Handle(RegenerateInvitationCommand request, CancellationToken cancellationToken)
        {
            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, request.ScopeKind, request.ScopeId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
            if (!eviction.IsActive)
            {
                return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
            }

            if (auth.Scope!.Kind == ScopeKinds.Club)
            {
                var club = await _db.Clubs.FirstOrDefaultAsync(c => c.Id == auth.Scope.Id, cancellationToken);
                if (club is null)
                {
                    return Results.NotFound(new ProblemDetails
                    {
                        Title = "Scope no encontrado",
                        Detail = "No existe el club indicado."
                    });
                }

                club.UpdateInvitationCode(GenerateUniqueCode());
                await _db.SaveChangesAsync(cancellationToken);

                return Results.Ok(new RegenerateInvitationResponse
                {
                    ScopeKind = ScopeKinds.Club,
                    ScopeId = club.Id,
                    NewCode = club.InvitationCode ?? string.Empty
                });
            }

            var team = await _db.Teams.FirstOrDefaultAsync(t => t.Id == auth.Scope.Id, cancellationToken);
            if (team is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Scope no encontrado",
                    Detail = "No existe el equipo indicado."
                });
            }

            var newCode = GenerateUniqueCode();
            var property = typeof(Team).GetProperty(nameof(Team.JoinCode));
            property?.SetValue(team, newCode);
            await _db.SaveChangesAsync(cancellationToken);

            return Results.Ok(new RegenerateInvitationResponse
            {
                ScopeKind = ScopeKinds.Team,
                ScopeId = team.Id,
                NewCode = newCode
            });
        }

        private static string GenerateUniqueCode()
        {
            return Guid.NewGuid().ToString("N")[..ValidationConstants.TeamJoinCodeLength].ToUpperInvariant();
        }
    }

    public class RegenerateInvitationValidator : AbstractValidator<RegenerateInvitationCommand>
    {
        public RegenerateInvitationValidator()
        {
            RuleFor(r => r.ScopeKind).Must(ScopeKinds.IsValid)
                .WithMessage("scopeKind debe ser 'club' o 'team'.");
            RuleFor(r => r.ScopeId).NotEmpty();
        }
    }
}
