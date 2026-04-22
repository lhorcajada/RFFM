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

                        var allRatings = await db.TeamPlayerRatings
                            .AsNoTracking()
                            .Include(r => r.Details)
                            .Where(r => teamPlayerIds.Contains(r.TeamPlayerId))
                            .OrderByDescending(r => r.RatedAt)
                            .ToListAsync(cancellationToken);

                        // Get latest per player in memory (GroupBy with Include not supported in EF translation)
                        var latestRatings = allRatings
                            .GroupBy(r => r.TeamPlayerId)
                            .Select(g => g.First())
                            .Select(r => new TeamLatestRatingResponse(
                                r.Id,
                                r.TeamPlayerId,
                                r.IsGoalkeeper,
                                r.Physical,
                                r.Technical,
                                r.Tactical,
                                r.Competitiveness,
                                r.Details.Select(d => new RatingAnswerResponse(d.CharacteristicKey, d.CategoryKey, d.Level, d.Concept)).ToList(),
                                r.RatedAt,
                                r.Notes))
                            .ToList();

                        return Results.Ok(latestRatings);
                    })
                .WithName(nameof(GetTeamLatestRatings))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<List<TeamLatestRatingResponse>>();
        }

        public record RatingAnswerResponse(
            string CharacteristicKey,
            string CategoryKey,
            int Level,
            string Concept);

        public record TeamLatestRatingResponse(
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
