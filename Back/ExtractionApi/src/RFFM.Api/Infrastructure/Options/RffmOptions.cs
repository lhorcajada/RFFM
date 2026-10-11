using RFFM.Api.Domain.Entities.Federation.Results;

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

        public RffmResultsRefreshSettings Results { get; set; } = new();

        public LeagueSquadStatsSettings LeagueSquadStats { get; set; } = new();
    }

    /// <summary>Estadísticas de las plantillas de liga (página «Rivales» de Coach).</summary>
    public class LeagueSquadStatsSettings
    {
        /// <summary>Tiempo mínimo entre dos actualizaciones pedidas a mano.</summary>
        public int MinRefreshMinutes { get; set; } = 60;

        /// <summary>false desactiva la actualización semanal automática (útil en desarrollo).</summary>
        public bool WeeklyEnabled { get; set; } = true;

        public DayOfWeek WeeklyDay { get; set; } = DayOfWeek.Monday;

        /// <summary>Hora local de Europe/Madrid, formato HH:mm.</summary>
        public string WeeklyTime { get; set; } = "00:01";

        /// <summary>Pausa antes de reintentar una ficha que la RFFM ha devuelto vacía.</summary>
        public int EmptySheetRetryDelayMs { get; set; } = 1500;
    }

    public record RffmSeasonOption(int Id, string Label);
}
