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
                            req.PhysicalSpeed,
                            req.PhysicalEndurance,
                            req.PhysicalStrength,
                            req.TechnicalDribbling,
                            req.TechnicalPassing,
                            req.TechnicalControl,
                            req.TechnicalShooting,
                            req.TechnicalTackling,
                            req.TechnicalInterceptions,
                            req.TechnicalHeading,
                            req.TacticalDefensiveAwareness,
                            req.TacticalMarking,
                            req.TacticalTrackBack,
                            req.TacticalPressing,
                            req.TacticalGeneratesAdvantage,
                            req.TacticalOffMovement,
                            req.TacticalBeatsOpponents,
                            req.TacticalAttackParticipation,
                            req.CompetDuelWinning,
                            req.CompetLooseBalls,
                            req.CompetRecoveries,
                            req.CompetDecisiveActions,
                            req.CompetResponsibility,
                            req.CompetConstantEffort,
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
                            rating.PhysicalSpeed,
                            rating.PhysicalEndurance,
                            rating.PhysicalStrength,
                            rating.TechnicalDribbling,
                            rating.TechnicalPassing,
                            rating.TechnicalControl,
                            rating.TechnicalShooting,
                            rating.TechnicalTackling,
                            rating.TechnicalInterceptions,
                            rating.TechnicalHeading,
                            rating.TacticalDefensiveAwareness,
                            rating.TacticalMarking,
                            rating.TacticalTrackBack,
                            rating.TacticalPressing,
                            rating.TacticalGeneratesAdvantage,
                            rating.TacticalOffMovement,
                            rating.TacticalBeatsOpponents,
                            rating.TacticalAttackParticipation,
                            rating.CompetDuelWinning,
                            rating.CompetLooseBalls,
                            rating.CompetRecoveries,
                            rating.CompetDecisiveActions,
                            rating.CompetResponsibility,
                            rating.CompetConstantEffort,
                            rating.RatedAt,
                            rating.Notes));
                    })
                .WithName(nameof(CreateTeamPlayerRating))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<RatingCreatedResponse>()
                .Produces(StatusCodes.Status404NotFound);
        }

        public record CreateRatingRequest(
            decimal PhysicalSpeed,
            decimal PhysicalEndurance,
            decimal PhysicalStrength,
            decimal TechnicalDribbling,
            decimal TechnicalPassing,
            decimal TechnicalControl,
            decimal TechnicalShooting,
            decimal TechnicalTackling,
            decimal TechnicalInterceptions,
            decimal TechnicalHeading,
            decimal TacticalDefensiveAwareness,
            decimal TacticalMarking,
            decimal TacticalTrackBack,
            decimal TacticalPressing,
            decimal TacticalGeneratesAdvantage,
            decimal TacticalOffMovement,
            decimal TacticalBeatsOpponents,
            decimal TacticalAttackParticipation,
            decimal CompetDuelWinning,
            decimal CompetLooseBalls,
            decimal CompetRecoveries,
            decimal CompetDecisiveActions,
            decimal CompetResponsibility,
            decimal CompetConstantEffort,
            string? Notes);

        public record RatingCreatedResponse(
            string Id,
            string TeamPlayerId,
            decimal Technical,
            decimal Tactical,
            decimal Physical,
            decimal Competitiveness,
            decimal? PhysicalSpeed,
            decimal? PhysicalEndurance,
            decimal? PhysicalStrength,
            decimal? TechnicalDribbling,
            decimal? TechnicalPassing,
            decimal? TechnicalControl,
            decimal? TechnicalShooting,
            decimal? TechnicalTackling,
            decimal? TechnicalInterceptions,
            decimal? TechnicalHeading,
            decimal? TacticalDefensiveAwareness,
            decimal? TacticalMarking,
            decimal? TacticalTrackBack,
            decimal? TacticalPressing,
            decimal? TacticalGeneratesAdvantage,
            decimal? TacticalOffMovement,
            decimal? TacticalBeatsOpponents,
            decimal? TacticalAttackParticipation,
            decimal? CompetDuelWinning,
            decimal? CompetLooseBalls,
            decimal? CompetRecoveries,
            decimal? CompetDecisiveActions,
            decimal? CompetResponsibility,
            decimal? CompetConstantEffort,
            DateTime RatedAt,
            string? Notes);

        public class CreateRatingValidator : AbstractValidator<CreateRatingRequest>
        {
            public CreateRatingValidator()
            {
                foreach (var rule in new[]
                {
                    RuleFor(r => r.PhysicalSpeed),
                    RuleFor(r => r.PhysicalEndurance),
                    RuleFor(r => r.PhysicalStrength),
                    RuleFor(r => r.TechnicalDribbling),
                    RuleFor(r => r.TechnicalPassing),
                    RuleFor(r => r.TechnicalControl),
                    RuleFor(r => r.TechnicalShooting),
                    RuleFor(r => r.TechnicalTackling),
                    RuleFor(r => r.TechnicalInterceptions),
                    RuleFor(r => r.TechnicalHeading),
                    RuleFor(r => r.TacticalDefensiveAwareness),
                    RuleFor(r => r.TacticalMarking),
                    RuleFor(r => r.TacticalTrackBack),
                    RuleFor(r => r.TacticalPressing),
                    RuleFor(r => r.TacticalGeneratesAdvantage),
                    RuleFor(r => r.TacticalOffMovement),
                    RuleFor(r => r.TacticalBeatsOpponents),
                    RuleFor(r => r.TacticalAttackParticipation),
                    RuleFor(r => r.CompetDuelWinning),
                    RuleFor(r => r.CompetLooseBalls),
                    RuleFor(r => r.CompetRecoveries),
                    RuleFor(r => r.CompetDecisiveActions),
                    RuleFor(r => r.CompetResponsibility),
                    RuleFor(r => r.CompetConstantEffort),
                })
                {
                    rule.InclusiveBetween(0m, 100m).Must(v => v == Math.Floor(v)).WithMessage("Debe ser un número entero entre 0 y 100.");
                }
                RuleFor(r => r.Notes).MaximumLength(500);
            }
        }
    }
}
