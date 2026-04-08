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
    public class GetTeamLatestRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/ratings/latest",
                    async (string teamId, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        // Get latest rating per teamplayer for the given team
                        var teamPlayerIds = await db.TeamPlayers
                            .AsNoTracking()
                            .Where(tp => tp.TeamId == teamId)
                            .Select(tp => tp.Id)
                            .ToListAsync(cancellationToken);

                        var latestRatings = await db.TeamPlayerRatings
                            .AsNoTracking()
                            .Where(r => teamPlayerIds.Contains(r.TeamPlayerId))
                            .GroupBy(r => r.TeamPlayerId)
                            .Select(g => g.OrderByDescending(r => r.RatedAt)
                                .Select(r => new TeamLatestRatingResponse(
                                    r.Id,
                                    r.TeamPlayerId,
                                    r.Technical,
                                    r.Tactical,
                                    r.Physical,
                                    r.Competitiveness,
                                    r.RatedAt,
                                    r.Notes))
                                .First())
                            .ToListAsync(cancellationToken);

                        return Results.Ok(latestRatings);
                    })
                .WithName(nameof(GetTeamLatestRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<List<TeamLatestRatingResponse>>();
        }

        public record TeamLatestRatingResponse(
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
