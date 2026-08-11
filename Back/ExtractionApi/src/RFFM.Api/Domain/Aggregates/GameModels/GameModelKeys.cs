namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Mechanical key derivation shared by the manual CRUD handlers (Features/Coaches/GameModels)
    /// and the markdown importer, per the technical import spec §1. Two runs against the same
    /// inputs must always produce the same key so imports can upsert instead of duplicate.
    /// </summary>
    public static class GameModelKeys
    {
        /// <summary>GameMoment.Id → faseSlug, matching the SeedGameMomentZones migration.</summary>
        public static readonly IReadOnlyDictionary<int, string> FaseSlugsById = new Dictionary<int, string>
        {
            [1] = "defensa-organizada",
            [2] = "ataque-organizado",
            [3] = "transicion-defensa-ataque",
            [4] = "transicion-ataque-defensa",
            [5] = "balon-parado",
        };

        public static readonly IReadOnlyDictionary<string, int> GameMomentIdsBySlug =
            FaseSlugsById.ToDictionary(kv => kv.Value, kv => kv.Key);

        /// <summary>GameZone.Id → zoneKey, matching the SeedGameMomentZones migration.</summary>
        public static readonly IReadOnlyDictionary<int, string> ZoneKeysById = new Dictionary<int, string>
        {
            [1] = "iniciacion",
            [2] = "creacion-propia",
            [3] = "creacion-rival",
            [4] = "finalizacion",
        };

        public static string BuildPrincipioKey(string faseSlug, int numero) => $"{faseSlug}-{numero}";

        public static string BuildSubprincipioKey(string faseSlug, string numero) => $"{faseSlug}-{numero}";

        public static string BuildSubSubPrincipioKey(string faseSlug, string numero) => $"{faseSlug}-{numero}";

        public static string BuildZonaKey(string faseSlug, string subprincipioNumero, string zoneKeysCsv, string? label = null)
        {
            var tokens = zoneKeysCsv.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            var zonePart = tokens.Length switch
            {
                1 => tokens[0],
                _ when tokens.Contains("compuesta") => "compuesta",
                _ => string.Join("-", tokens),
            };

            var key = $"{faseSlug}-{subprincipioNumero}-{zonePart}";
            if (!string.IsNullOrWhiteSpace(label))
                key += "-" + Slugify(label);

            return key;
        }

        private static string Slugify(string value) =>
            new string(value.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray())
                .Replace("--", "-").Trim('-');
    }
}
