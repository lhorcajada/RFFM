namespace RFFM.Api.Domain.Entities.Competitions
{
    /// <summary>
    /// Standard F11 match duration (minutes) per category. Only Juveniles/Cadetes/Infantiles/
    /// Alevines play F11; other categories (Nacional/Aficionados/Benjamines/Prebenjamines/
    /// Debutantes) are F7 or smaller and have no standard duration registered here — see
    /// openspec/changes/squad-statistics-minutes-target-mobile-layout/design.md.
    /// </summary>
    public static class MatchDurationMinutesByCategory
    {
        private static readonly Dictionary<int, int> Minutes = new()
        {
            [Category.Youth.Id] = 45, // Juveniles
            [Category.U14.Id] = 40,   // Cadetes
            [Category.U12.Id] = 35,   // Infantiles
            [Category.U10.Id] = 30,   // Alevines
        };

        public static bool TryGetMinutes(int categoryId, out int minutes) => Minutes.TryGetValue(categoryId, out minutes);
    }
}
