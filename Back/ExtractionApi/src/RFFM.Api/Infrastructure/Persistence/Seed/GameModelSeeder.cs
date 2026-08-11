using RFFM.Api.Infrastructure.GameModelImport;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    /// <summary>
    /// Seeds/re-imports a team's real game model from `docs/game-model/ADN-Modelo-de-Juego-Legible.md`
    /// via <see cref="AdnLegibleImporter"/>, per design.md §2.1. Not run automatically on every
    /// app startup (seeding a specific team/season is an operator decision, not schema setup) —
    /// invoke <see cref="SeedAsync"/> once for the target team/season (e.g. from a one-off admin
    /// endpoint, a migrations runbook step, or a test/tool), and safely re-invoke whenever the
    /// legible document changes, since the importer upserts by <c>Key</c> (idempotent).
    /// </summary>
    public static class GameModelSeeder
    {
        public const string DefaultRelativePath = "docs/game-model/ADN-Modelo-de-Juego-Legible.md";

        public static async Task<string> SeedAsync(
            AppDbContext db,
            string teamId,
            string modelName,
            string season,
            string? legibleDocPath = null,
            CancellationToken ct = default)
        {
            var path = legibleDocPath ?? ResolveDefaultPath();
            var markdown = await File.ReadAllTextAsync(path, ct);

            var importer = new AdnLegibleImporter();
            var imported = importer.Parse(markdown);

            return await importer.UpsertAsync(db, imported, teamId, modelName, season, ct);
        }

        private static string ResolveDefaultPath()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, DefaultRelativePath.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(candidate))
                    return candidate;
                dir = dir.Parent;
            }

            throw new FileNotFoundException($"Could not locate '{DefaultRelativePath}' relative to {AppContext.BaseDirectory}.");
        }
    }
}
