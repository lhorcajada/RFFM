#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    internal static class PositionFitTestSupport
    {
        /// <summary>Seeds a team player with the given demarcations (active one first) and optional trait levels.</summary>
        internal static async Task<string> SeedFieldPlayerAsync(
            AppDbContext db,
            string teamId,
            string clubId,
            string seasonId,
            string alias,
            int activePositionId,
            int[]? possible = null,
            Dictionary<string, int>? levels = null,
            string trend = TraitTrend.Same)
        {
            var teamPlayerId = await SeedPlayerAsync(db, teamId, clubId, seasonId, $"{alias}-{Guid.NewGuid():N}");
            var teamPlayer = await db.TeamPlayers.FindAsync(teamPlayerId);
            teamPlayer!.SetDemarcation(new DemarcationModel
            {
                ActivePositionId = activePositionId,
                PossibleDemarcations = (possible ?? new[] { activePositionId }).ToList(),
            });
            await db.SaveChangesAsync();

            if (levels is not null)
                await RateAsync(db, teamPlayerId, levels, trend, DateTimeOffset.UtcNow);

            return teamPlayerId;
        }

        internal static async Task RateAsync(
            AppDbContext db,
            string teamPlayerId,
            Dictionary<string, int> levels,
            string trend,
            DateTimeOffset ratedAt)
        {
            db.TeamPlayerTraitRatings.Add(TeamPlayerTraitRating.Create(
                teamPlayerId,
                levels.Select(l => (l.Key, l.Value)).ToList(),
                trend,
                ratedAt));
            await db.SaveChangesAsync();
        }
    }
}
