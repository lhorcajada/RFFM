using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    // Not gated by IRequireFeaturePermission: this route is an inline Minimal API handler (not a
    // Mediator ICommand/IQueryApp). [Authorize] requires an authenticated caller, and Player/
    // FamilyMember callers are additionally restricted, in-handler, to their own linked
    // TeamPlayer (via UserTeam.LinkedTeamPlayerId) to prevent leaking other families' ratings.
    public class GetTeamLatestRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/ratings/latest",
                    [Authorize]
                    async (string teamId, AppDbContext db, ICurrentUserService currentUser, CancellationToken cancellationToken) =>
                    {
                        // Get latest rating per teamplayer for the given team
                        var teamPlayerIds = await db.TeamPlayers
                            .AsNoTracking()
                            .Where(tp => tp.TeamId == teamId)
                            .Select(tp => tp.Id)
                            .ToListAsync(cancellationToken);

                        var isPrivilegedRole = (currentUser.Roles ?? Enumerable.Empty<string>())
                            .Any(r => string.Equals(r, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.Federation.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase));

                        if (!isPrivilegedRole)
                        {
                            var linkedTeamPlayerIds = await db.Set<UserTeam>()
                                .AsNoTracking()
                                .Where(ut =>
                                    ut.ApplicationUserId == currentUser.UserId &&
                                    ut.TeamId == teamId &&
                                    ut.LinkedTeamPlayerId != null)
                                .Select(ut => ut.LinkedTeamPlayerId!)
                                .ToListAsync(cancellationToken);

                            teamPlayerIds = teamPlayerIds.Intersect(linkedTeamPlayerIds).ToList();
                        }

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
                .Produces<List<TeamLatestRatingResponse>>()
                .Produces(StatusCodes.Status401Unauthorized);
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
