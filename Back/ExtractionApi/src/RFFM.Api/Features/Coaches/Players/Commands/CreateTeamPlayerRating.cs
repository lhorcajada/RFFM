using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class CreateTeamPlayerRating : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{id}/ratings",
                    async (string id, CreateRatingRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var teamPlayer = await db.TeamPlayers
                            .FirstOrDefaultAsync(tp => tp.Id == id, cancellationToken);

                        if (teamPlayer == null)
                            return Results.NotFound();

                        var rating = TeamPlayerRating.Create(
                            id,
                            req.Technical,
                            req.Tactical,
                            req.Physical,
                            req.Competitiveness,
                            req.Notes);

                        db.TeamPlayerRatings.Add(rating);
                        await db.SaveChangesAsync(cancellationToken);

                        return Results.Ok(new RatingCreatedResponse(
                            rating.Id,
                            rating.TeamPlayerId,
                            rating.Technical,
                            rating.Tactical,
                            rating.Physical,
                            rating.Competitiveness,
                            rating.RatedAt,
                            rating.Notes));
                    })
                .WithName(nameof(CreateTeamPlayerRating))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<RatingCreatedResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }

        public record CreateRatingRequest(
            byte Technical,
            byte Tactical,
            byte Physical,
            byte Competitiveness,
            string? Notes);

        public record RatingCreatedResponse(
            string Id,
            string TeamPlayerId,
            byte Technical,
            byte Tactical,
            byte Physical,
            byte Competitiveness,
            DateTime RatedAt,
            string? Notes);

        public class CreateRatingValidator : AbstractValidator<CreateRatingRequest>
        {
            public CreateRatingValidator()
            {
                RuleFor(r => r.Technical).InclusiveBetween((byte)1, (byte)5);
                RuleFor(r => r.Tactical).InclusiveBetween((byte)1, (byte)5);
                RuleFor(r => r.Physical).InclusiveBetween((byte)1, (byte)5);
                RuleFor(r => r.Competitiveness).InclusiveBetween((byte)1, (byte)5);
                RuleFor(r => r.Notes).MaximumLength(500);
            }
        }
    }
}
