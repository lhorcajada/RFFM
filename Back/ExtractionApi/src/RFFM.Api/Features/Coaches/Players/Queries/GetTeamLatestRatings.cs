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
                                    r.IsGoalkeeper,
                                    r.Technical,
                                    r.Tactical,
                                    r.Physical,
                                    r.Competitiveness,
                                    r.PhysicalSpeed,
                                    r.PhysicalEndurance,
                                    r.PhysicalStrength,
                                    r.TechnicalDribbling,
                                    r.TechnicalPassing,
                                    r.TechnicalControl,
                                    r.TechnicalShooting,
                                    r.TechnicalTackling,
                                    r.TechnicalInterceptions,
                                    r.TechnicalHeading,
                                    r.TacticalDefensiveAwareness,
                                    r.TacticalMarking,
                                    r.TacticalTrackBack,
                                    r.TacticalPressing,
                                    r.TacticalGeneratesAdvantage,
                                    r.TacticalOffMovement,
                                    r.TacticalBeatsOpponents,
                                    r.TacticalAttackParticipation,
                                    r.CompetDuelWinning,
                                    r.CompetLooseBalls,
                                    r.CompetRecoveries,
                                    r.CompetDecisiveActions,
                                    r.CompetResponsibility,
                                    r.CompetConstantEffort,
                                    r.KeeperReactionSpeed,
                                    r.KeeperAgility,
                                    r.KeeperJumpPower,
                                    r.KeeperStrength,
                                    r.KeeperEndurance,
                                    r.KeeperHandSecurity,
                                    r.KeeperSaves,
                                    r.KeeperAerialPlay,
                                    r.KeeperHandDistribution,
                                    r.KeeperKickDistribution,
                                    r.KeeperFirstTouch,
                                    r.KeeperPlayUnderPressure,
                                    r.KeeperPositioning,
                                    r.KeeperGameReading,
                                    r.KeeperOneOnOne,
                                    r.KeeperBackCoverage,
                                    r.KeeperSallyTiming,
                                    r.KeeperBuildupPlay,
                                    r.KeeperDefensiveOrganization,
                                    r.KeeperValor,
                                    r.KeeperConcentration,
                                    r.KeeperKeyMoments,
                                    r.KeeperErrorManagement,
                                    r.KeeperResponsibility,
                                    r.KeeperConsistency,
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
            bool IsGoalkeeper,
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
    }
}
