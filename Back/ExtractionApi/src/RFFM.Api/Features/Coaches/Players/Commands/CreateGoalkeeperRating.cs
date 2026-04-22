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
    public class CreateGoalkeeperRating : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/teamplayer/{id}/ratings/goalkeeper",
                    async (string id, CreateGoalkeeperRatingRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var teamPlayer = await db.TeamPlayers
                            .FirstOrDefaultAsync(tp => tp.Id == id, cancellationToken);

                        if (teamPlayer == null)
                            return Results.NotFound();

                        var rating = TeamPlayerRating.CreateForGoalkeeper(
                            id,
                            req.KeeperReactionSpeed,
                            req.KeeperAgility,
                            req.KeeperJumpPower,
                            req.KeeperStrength,
                            req.KeeperEndurance,
                            req.KeeperHandSecurity,
                            req.KeeperSaves,
                            req.KeeperAerialPlay,
                            req.KeeperHandDistribution,
                            req.KeeperKickDistribution,
                            req.KeeperFirstTouch,
                            req.KeeperPlayUnderPressure,
                            req.KeeperPositioning,
                            req.KeeperGameReading,
                            req.KeeperOneOnOne,
                            req.KeeperBackCoverage,
                            req.KeeperSallyTiming,
                            req.KeeperBuildupPlay,
                            req.KeeperDefensiveOrganization,
                            req.KeeperValor,
                            req.KeeperConcentration,
                            req.KeeperKeyMoments,
                            req.KeeperErrorManagement,
                            req.KeeperResponsibility,
                            req.KeeperConsistency,
                            req.Notes);

                        var previousRatings = await db.TeamPlayerRatings
                            .Where(r => r.TeamPlayerId == id)
                            .ToListAsync(cancellationToken);

                        if (previousRatings.Count > 0)
                        {
                            db.TeamPlayerRatings.RemoveRange(previousRatings);
                        }

                        db.TeamPlayerRatings.Add(rating);
                        await db.SaveChangesAsync(cancellationToken);

                        return Results.Ok(new GoalkeeperRatingCreatedResponse(
                            rating.Id,
                            rating.TeamPlayerId,
                            rating.IsGoalkeeper,
                            rating.Technical,
                            rating.Tactical,
                            rating.Physical,
                            rating.Competitiveness,
                            rating.KeeperReactionSpeed,
                            rating.KeeperAgility,
                            rating.KeeperJumpPower,
                            rating.KeeperStrength,
                            rating.KeeperEndurance,
                            rating.KeeperHandSecurity,
                            rating.KeeperSaves,
                            rating.KeeperAerialPlay,
                            rating.KeeperHandDistribution,
                            rating.KeeperKickDistribution,
                            rating.KeeperFirstTouch,
                            rating.KeeperPlayUnderPressure,
                            rating.KeeperPositioning,
                            rating.KeeperGameReading,
                            rating.KeeperOneOnOne,
                            rating.KeeperBackCoverage,
                            rating.KeeperSallyTiming,
                            rating.KeeperBuildupPlay,
                            rating.KeeperDefensiveOrganization,
                            rating.KeeperValor,
                            rating.KeeperConcentration,
                            rating.KeeperKeyMoments,
                            rating.KeeperErrorManagement,
                            rating.KeeperResponsibility,
                            rating.KeeperConsistency,
                            rating.RatedAt,
                            rating.Notes));
                    })
                .WithName(nameof(CreateGoalkeeperRating))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<GoalkeeperRatingCreatedResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }

        public record CreateGoalkeeperRatingRequest(
            decimal KeeperReactionSpeed,
            decimal KeeperAgility,
            decimal KeeperJumpPower,
            decimal KeeperStrength,
            decimal KeeperEndurance,
            decimal KeeperHandSecurity,
            decimal KeeperSaves,
            decimal KeeperAerialPlay,
            decimal KeeperHandDistribution,
            decimal KeeperKickDistribution,
            decimal KeeperFirstTouch,
            decimal KeeperPlayUnderPressure,
            decimal KeeperPositioning,
            decimal KeeperGameReading,
            decimal KeeperOneOnOne,
            decimal KeeperBackCoverage,
            decimal KeeperSallyTiming,
            decimal KeeperBuildupPlay,
            decimal KeeperDefensiveOrganization,
            decimal KeeperValor,
            decimal KeeperConcentration,
            decimal KeeperKeyMoments,
            decimal KeeperErrorManagement,
            decimal KeeperResponsibility,
            decimal KeeperConsistency,
            string? Notes);

        public record GoalkeeperRatingCreatedResponse(
            string Id,
            string TeamPlayerId,
            bool IsGoalkeeper,
            decimal Technical,
            decimal Tactical,
            decimal Physical,
            decimal Competitiveness,
            decimal? KeeperReactionSpeed,
            decimal? KeeperAgility,
            decimal? KeeperJumpPower,
            decimal? KeeperStrength,
            decimal? KeeperEndurance,
            decimal? KeeperHandSecurity,
            decimal? KeeperSaves,
            decimal? KeeperAerialPlay,
            decimal? KeeperHandDistribution,
            decimal? KeeperKickDistribution,
            decimal? KeeperFirstTouch,
            decimal? KeeperPlayUnderPressure,
            decimal? KeeperPositioning,
            decimal? KeeperGameReading,
            decimal? KeeperOneOnOne,
            decimal? KeeperBackCoverage,
            decimal? KeeperSallyTiming,
            decimal? KeeperBuildupPlay,
            decimal? KeeperDefensiveOrganization,
            decimal? KeeperValor,
            decimal? KeeperConcentration,
            decimal? KeeperKeyMoments,
            decimal? KeeperErrorManagement,
            decimal? KeeperResponsibility,
            decimal? KeeperConsistency,
            DateTime RatedAt,
            string? Notes);

        public class CreateGoalkeeperRatingValidator : AbstractValidator<CreateGoalkeeperRatingRequest>
        {
            public CreateGoalkeeperRatingValidator()
            {
                foreach (var rule in new[]
                {
                    RuleFor(r => r.KeeperReactionSpeed),
                    RuleFor(r => r.KeeperAgility),
                    RuleFor(r => r.KeeperJumpPower),
                    RuleFor(r => r.KeeperStrength),
                    RuleFor(r => r.KeeperEndurance),
                    RuleFor(r => r.KeeperHandSecurity),
                    RuleFor(r => r.KeeperSaves),
                    RuleFor(r => r.KeeperAerialPlay),
                    RuleFor(r => r.KeeperHandDistribution),
                    RuleFor(r => r.KeeperKickDistribution),
                    RuleFor(r => r.KeeperFirstTouch),
                    RuleFor(r => r.KeeperPlayUnderPressure),
                    RuleFor(r => r.KeeperPositioning),
                    RuleFor(r => r.KeeperGameReading),
                    RuleFor(r => r.KeeperOneOnOne),
                    RuleFor(r => r.KeeperBackCoverage),
                    RuleFor(r => r.KeeperSallyTiming),
                    RuleFor(r => r.KeeperBuildupPlay),
                    RuleFor(r => r.KeeperDefensiveOrganization),
                    RuleFor(r => r.KeeperValor),
                    RuleFor(r => r.KeeperConcentration),
                    RuleFor(r => r.KeeperKeyMoments),
                    RuleFor(r => r.KeeperErrorManagement),
                    RuleFor(r => r.KeeperResponsibility),
                    RuleFor(r => r.KeeperConsistency),
                })
                {
                    rule.InclusiveBetween(0m, 100m).Must(v => v == Math.Floor(v)).WithMessage("Debe ser un número entero entre 0 y 100.");
                }
                RuleFor(r => r.Notes).MaximumLength(500);
            }
        }
    }
}
