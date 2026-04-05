using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    /// <summary>
    /// Returns the list of seasons that have a game model for the given team.
    /// GET /api/game-models/seasons?teamId={teamId}
    /// </summary>
    public class GetGameModelSeasons : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models/seasons",
                    async (string teamId, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        return Results.Ok(await mediator.Send(new SeasonsQuery(teamId, userId), cancellationToken));
                    })
                .WithName(nameof(GetGameModelSeasons))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<string[]>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record SeasonsQuery(string TeamId, string UserId) : IQueryApp<string[]>;

        public class Handler : IRequestHandler<SeasonsQuery, string[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<string[]> Handle(SeasonsQuery request, CancellationToken cancellationToken = default)
            {
                var hasAccess = await _db.UserClubs
                    .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                    .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

                if (!hasAccess)
                    throw new DomainException("Modelo de Juego", "No tienes acceso a este equipo.", "");

                return await _db.GameModels
                    .Where(gm => gm.TeamId == request.TeamId)
                    .OrderByDescending(gm => gm.Season)
                    .Select(gm => gm.Season)
                    .AsNoTracking()
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
