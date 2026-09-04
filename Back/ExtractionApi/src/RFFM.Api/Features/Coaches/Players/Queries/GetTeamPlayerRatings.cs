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
    public class GetTeamPlayerRatings : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/teamplayer/{id}/ratings",
                    [Authorize]
                    async (string id, AppDbContext db, ICurrentUserService currentUser, CancellationToken cancellationToken) =>
                    {
                        var teamPlayer = await db.TeamPlayers
                            .AsNoTracking()
                            .Where(tp => tp.Id == id)
                            .Select(tp => new { tp.Id, tp.TeamId })
                            .FirstOrDefaultAsync(cancellationToken);

                        if (teamPlayer == null)
                            return Results.NotFound();

                        var isPrivilegedRole = (currentUser.Roles ?? Enumerable.Empty<string>())
                            .Any(r => string.Equals(r, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.Federation.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.ClubDirector.Name, StringComparison.OrdinalIgnoreCase));

                        var isOwnPlayer = isPrivilegedRole || await db.Set<UserTeam>()
                            .AsNoTracking()
                            .AnyAsync(ut =>
                                ut.ApplicationUserId == currentUser.UserId &&
                                ut.TeamId == teamPlayer.TeamId &&
                                ut.LinkedTeamPlayerId == id,
                                cancellationToken);

                        if (!isOwnPlayer)
                            return Results.Forbid();

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
                .Produces<List<TeamPlayerRatingResponse>>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status403Forbidden)
                .Produces(StatusCodes.Status404NotFound);
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
