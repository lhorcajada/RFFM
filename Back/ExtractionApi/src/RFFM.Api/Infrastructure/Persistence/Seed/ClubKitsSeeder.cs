using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    public static class ClubKitsSeeder
    {
        private const string ClubId = "85c6db34-26fc-405a-9734-fc6a31a9aa18";

        public static async Task SeedAsync(AppDbContext context, ILogger? logger = null, CancellationToken cancellationToken = default)
        {
            // Resolve the season from the club's teams — avoids hardcoding a season name
            var seasonId = await context.Teams
                .AsNoTracking()
                .Where(t => t.ClubId == ClubId)
                .Select(t => t.SeasonId)
                .FirstOrDefaultAsync(cancellationToken);

            if (seasonId == null)
            {
                logger?.LogWarning("ClubKitsSeeder: no se encontraron equipos para el club '{ClubId}'. Se omite el seed de equipaciones.", ClubId);
                return;
            }

            if (await context.ClubKits.AnyAsync(k => k.ClubId == ClubId && k.SeasonId == seasonId, cancellationToken))
                return;

            var kits = new[]
            {
                ClubKit.Create(ClubId, seasonId, kitNumber: 1, shirtColor: "#0000FF", shortsColor: "#0000FF", socksColor: "#0000FF"),
                ClubKit.Create(ClubId, seasonId, kitNumber: 2, shirtColor: "#FF0000", shortsColor: "#FF0000", socksColor: "#FF0000"),
            };

            context.ClubKits.AddRange(kits);
            await context.SaveChangesAsync(cancellationToken);
            logger?.LogInformation("ClubKitsSeeder: equipaciones sembradas para club '{ClubId}', temporada '{SeasonId}'.", ClubId, seasonId);
        }
    }
}
