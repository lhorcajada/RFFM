using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Scopes.Commands
{
    public class LeaveScope : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/scopes/members/leave",
                    async (IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new LeaveScopeCommand { UserId = userId };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(LeaveScope))
                .WithTags(ScopesConstants.ScopesFeature)
                .RequireAuthorization()
                .Produces<LeaveScopeResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class LeaveScopeCommand : IRequest<IResult>
    {
        public string UserId { get; set; } = string.Empty;
    }

    public class LeaveScopeResponse
    {
        public LeftScope LeftScope { get; set; } = new();
    }

    public class LeftScope
    {
        public string Kind { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public class LeaveScopeHandler : IRequestHandler<LeaveScopeCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly ITokenService _tokenService;

        public LeaveScopeHandler(AppDbContext db, ITokenService tokenService)
        {
            _db = db;
            _tokenService = tokenService;
        }

        public async ValueTask<IResult> Handle(LeaveScopeCommand request, CancellationToken cancellationToken)
        {
            var clubLink = await _db.UserClubs
                .Include(uc => uc.Club)
                .Where(uc => uc.ApplicationUserId == request.UserId)
                .ToListAsync(cancellationToken);

            if (clubLink.Any(uc => uc.IsCreator))
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Un creador no puede abandonar su espacio",
                    Detail = "Un creador no puede abandonar su espacio; debe cancelar su suscripción o transferir ownership (futuro)."
                });
            }

            if (clubLink.Count > 0)
            {
                var leftClub = clubLink.First();
                _db.UserClubs.RemoveRange(clubLink);
                await _db.SaveChangesAsync(cancellationToken);

                await TryRefreshTokenAsync(request.UserId, cancellationToken);

                return Results.Ok(new LeaveScopeResponse
                {
                    LeftScope = new LeftScope
                    {
                        Kind = ScopeKinds.Club,
                        Id = leftClub.Club?.Id ?? leftClub.ClubId,
                        Name = leftClub.Club?.Name ?? string.Empty
                    }
                });
            }

            var teamLink = await _db.UserTeams
                .Include(ut => ut.Team)
                .Where(ut => ut.ApplicationUserId == request.UserId)
                .ToListAsync(cancellationToken);

            if (teamLink.Any(ut => ut.IsCreator))
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Un creador no puede abandonar su espacio",
                    Detail = "Un creador no puede abandonar su espacio; debe cancelar su suscripción o transferir ownership (futuro)."
                });
            }

            if (teamLink.Count == 0)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Sin espacio activo",
                    Detail = "No perteneces a ningún espacio."
                });
            }

            var leftTeam = teamLink.First();
            _db.UserTeams.RemoveRange(teamLink);
            await _db.SaveChangesAsync(cancellationToken);

            await TryRefreshTokenAsync(request.UserId, cancellationToken);

            return Results.Ok(new LeaveScopeResponse
            {
                LeftScope = new LeftScope
                {
                    Kind = ScopeKinds.Team,
                    Id = leftTeam.Team?.Id ?? leftTeam.TeamId,
                    Name = leftTeam.Team?.Name ?? string.Empty
                }
            });
        }

        private async Task TryRefreshTokenAsync(string userId, CancellationToken cancellationToken)
        {
            try
            {
                await _tokenService.GenerateJwtForUser(userId, cancellationToken);
            }
            catch
            {
            }
        }
    }
}
