using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class CreateConceptualRating : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{id}/ratings/conceptual",
                    async (string id, CreateConceptualRatingRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        if (req.Answers == null || req.Answers.Count == 0)
                            return Results.BadRequest("At least one answer is required.");

                        var teamPlayer = await db.TeamPlayers
                            .FirstOrDefaultAsync(tp => tp.Id == id, cancellationToken);

                        if (teamPlayer == null)
                            return Results.NotFound();

                        var answers = req.Answers
                            .Select(a => (a.CharacteristicKey, a.CategoryKey, a.Level, a.Concept))
                            .ToList()
                            .AsReadOnly();

                        TeamPlayerRating rating;
                        try
                        {
                            rating = TeamPlayerRating.CreateConceptual(id, req.IsGoalkeeper, answers, req.Notes, req.RatedAt);
                        }
                        catch (ArgumentException ex)
                        {
                            return Results.BadRequest(ex.Message);
                        }

                        db.TeamPlayerRatings.Add(rating);
                        await db.SaveChangesAsync(cancellationToken);

                        // Reload with details to build response
                        var saved = await db.TeamPlayerRatings
                            .AsNoTracking()
                            .Include(r => r.Details)
                            .FirstAsync(r => r.Id == rating.Id, cancellationToken);

                        return Results.Ok(ToResponse(saved));
                    })
                .WithName(nameof(CreateConceptualRating))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<ConceptualRatingResponse>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status400BadRequest);
        }

        internal static ConceptualRatingResponse ToResponse(TeamPlayerRating r) =>
            new(
                r.Id,
                r.TeamPlayerId,
                r.IsGoalkeeper,
                r.Physical,
                r.Technical,
                r.Tactical,
                r.Competitiveness,
                r.Details.Select(d => new RatingAnswerResponse(
                    d.CharacteristicKey,
                    d.CategoryKey,
                    d.Level,
                    d.Concept)).ToList(),
                r.RatedAt,
                r.Notes);

        public record CharacteristicAnswerRequest(
            string CharacteristicKey,
            string CategoryKey,
            int Level,
            string Concept);

        public record CreateConceptualRatingRequest(
            bool IsGoalkeeper,
            IReadOnlyList<CharacteristicAnswerRequest> Answers,
            string? Notes,
            DateTimeOffset? RatedAt = null);

        public record RatingAnswerResponse(
            string CharacteristicKey,
            string CategoryKey,
            int Level,
            string Concept);

        public record ConceptualRatingResponse(
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
