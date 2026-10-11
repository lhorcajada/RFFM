namespace RFFM.Api.Domain.Entities.Federation.LeagueSquadStats
{
    public record PlayerSeasonTotals(
        string PlayerName, int? BirthYear, string? Position,
        int Called, int Starter, int Substitute, int Played, int Goals,
        int Yellow, int Red, int DoubleYellow,
        string ParticipationsJson, bool HasActivity);

    /// <summary>
    /// Totales de la ficha RFFM de un jugador en una temporada. Una fila por jugador y temporada,
    /// compartida entre todas las ligas en las que aparezca el jugador.
    /// </summary>
    public class RffmPlayerSeasonStats : BaseEntity
    {
        public static class Rules
        {
            public const int PlayerCodeMaxLength = 50;
            public const int PlayerNameMaxLength = 256;
            public const int PositionMaxLength = 100;
        }

        public string PlayerCode { get; private set; } = null!;
        public int SeasonId { get; private set; }
        public string PlayerName { get; private set; } = null!;
        public int? BirthYear { get; private set; }
        public string? Position { get; private set; }
        public int Called { get; private set; }
        public int Starter { get; private set; }
        public int Substitute { get; private set; }
        public int Played { get; private set; }
        public int Goals { get; private set; }
        public int Yellow { get; private set; }
        public int Red { get; private set; }
        public int DoubleYellow { get; private set; }
        /// <summary>Equipos en los que participó esa temporada, serializados en JSON (solo lectura).</summary>
        public string ParticipationsJson { get; private set; } = "[]";
        /// <summary>false: la RFFM devolvió la ficha, pero sin convocatorias ni competiciones esa temporada.</summary>
        public bool HasActivity { get; private set; }
        public DateTime FetchedAt { get; private set; }

        private RffmPlayerSeasonStats() { }

        public static RffmPlayerSeasonStats Create(string playerCode, int seasonId, PlayerSeasonTotals totals, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(playerCode))
                throw new ArgumentException("El jugador es obligatorio.");

            var stats = new RffmPlayerSeasonStats { PlayerCode = playerCode.Trim(), SeasonId = seasonId };
            stats.Update(totals, now);
            return stats;
        }

        public void Update(PlayerSeasonTotals totals, DateTime now)
        {
            PlayerName = (totals.PlayerName ?? string.Empty).Trim();
            BirthYear = totals.BirthYear;
            Position = string.IsNullOrWhiteSpace(totals.Position) ? null : totals.Position.Trim();
            Called = totals.Called;
            Starter = totals.Starter;
            Substitute = totals.Substitute;
            Played = totals.Played;
            Goals = totals.Goals;
            Yellow = totals.Yellow;
            Red = totals.Red;
            DoubleYellow = totals.DoubleYellow;
            ParticipationsJson = string.IsNullOrWhiteSpace(totals.ParticipationsJson) ? "[]" : totals.ParticipationsJson;
            HasActivity = totals.HasActivity;
            FetchedAt = now;
        }
    }
}
