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
                            .Include(r => r.Details)
                            .Where(r => r.TeamPlayerId == id)
                            .OrderByDescending(r => r.RatedAt)
                            .ToListAsync(cancellationToken);

                        var response = ratings.Select(r => new TeamPlayerRatingResponse(
                            r.Id,
                            r.TeamPlayerId,
                            r.IsGoalkeeper,
                            r.Physical,
                            r.Technical,
                            r.Tactical,
                            r.Competitiveness,
                            r.Details.Select(d => new RatingAnswerResponse(d.CharacteristicKey, d.CategoryKey, d.Level, d.Concept)).ToList(),
                            r.RatedAt,
                            r.Notes)).ToList();

                        return Results.Ok(response);
                    })
                .WithName(nameof(GetTeamPlayerRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<List<TeamPlayerRatingResponse>>();
        }

        public record RatingAnswerResponse(
            string CharacteristicKey,
            string CategoryKey,
            int Level,
            string Concept);

        public record TeamPlayerRatingResponse(
            string Id,
            string TeamPlayerId,
            bool IsGoalkeeper,
            decimal Physical,
            decimal Technical,
            decimal Tactical,
            decimal Competitiveness,
            IReadOnlyList<RatingAnswerResponse> Answers,
            DateTime RatedAt,
            string? Notes);
    }
}
