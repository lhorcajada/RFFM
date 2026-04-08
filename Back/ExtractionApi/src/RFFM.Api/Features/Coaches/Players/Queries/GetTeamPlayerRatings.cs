using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetTeamPlayerRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teamplayer/{id}/ratings",
                    async (string id, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var exists = await db.TeamPlayers
                            .AnyAsync(tp => tp.Id == id, cancellationToken);

                        if (!exists)
                            return Results.NotFound();

                        var ratings = await db.TeamPlayerRatings
                            .AsNoTracking()
                            .Where(r => r.TeamPlayerId == id)
                            .OrderByDescending(r => r.RatedAt)
                            .Select(r => new TeamPlayerRatingResponse(
                                r.Id,
                                r.TeamPlayerId,
                                r.Technical,
                                r.Tactical,
                                r.Physical,
                                r.Competitiveness,
                                r.RatedAt,
                                r.Notes))
                            .ToListAsync(cancellationToken);

                        return Results.Ok(ratings);
                    })
                .WithName(nameof(GetTeamPlayerRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<List<TeamPlayerRatingResponse>>();
        }

        public record TeamPlayerRatingResponse(
            string Id,
            string TeamPlayerId,
            byte Technical,
            byte Tactical,
            byte Physical,
            byte Competitiveness,
            DateTime RatedAt,
            string? Notes);
    }
}
