using Microsoft.EntityFrameworkCore;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    /// <summary>
    /// Shared ADN (GameModel) node lookup used by seeders/importers that need to resolve a
    /// team's real Subprincipio id from a `(GameMomentId, Numero)` pair — e.g.
    /// <see cref="ExampleSessionSeeder"/> and <c>RFFM.Api.Infrastructure.Services
    /// .SeasonPlanImporter</c>. Moved here from <see cref="ExampleSessionSeeder"/> (which had
    /// the first copy) by the `season-plan-target-subprincipios` OpenSpec change to avoid a
    /// second, verbatim-duplicate copy in the importer.
    /// </summary>
    internal static class AdnLookup
    {
        public static async Task<string?> ResolveSubprincipioIdAsync(
            AppDbContext db, string teamId, int gameMomentId, string numero, CancellationToken ct) =>
            await db.Subprincipios
                .AsNoTracking()
                .Where(s => s.GamePrinciple.GameMomentId == gameMomentId && s.GamePrinciple.GameModel.TeamId == teamId && s.Numero == numero)
                .Select(s => s.Id)
                .FirstOrDefaultAsync(ct);
    }
}
