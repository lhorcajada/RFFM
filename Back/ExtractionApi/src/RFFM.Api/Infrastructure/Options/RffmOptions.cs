namespace RFFM.Api.Infrastructure.Options
{
    public class RffmOptions
    {
        public int CurrentSeasonId { get; set; } = 22; // 2026-2027

        public List<RffmSeasonOption> SelectableSeasons { get; set; } =
        [
            new(22, "2026-2027"),
            new(21, "2025-2026"),
            new(20, "2024-2025"),
        ];

        public int BackgroundMinDelayMs { get; set; } = 800;

        public int BackgroundRetryBaseDelayMs { get; set; } = 2000;
    }

    public record RffmSeasonOption(int Id, string Label);
}
