using RFFM.Api.Domain.Entities.Seasons;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class ClubKit : BaseEntity
    {
        public string ClubId { get; private set; } = null!;
        public string SeasonId { get; private set; } = null!;
        /// <summary>1 = primera equipación, 2 = segunda equipación.</summary>
        public int KitNumber { get; private set; }
        public string ShirtColor { get; private set; } = null!;
        public string ShortsColor { get; private set; } = null!;
        public string SocksColor { get; private set; } = null!;

        public Club Club { get; private set; } = null!;
        public Season Season { get; private set; } = null!;

        private ClubKit() { }

        public static ClubKit Create(
            string clubId,
            string seasonId,
            int kitNumber,
            string shirtColor,
            string shortsColor,
            string socksColor)
        {
            if (kitNumber is not (1 or 2))
                throw new ArgumentOutOfRangeException(nameof(kitNumber), "KitNumber debe ser 1 (primera) o 2 (segunda).");

            return new ClubKit
            {
                ClubId = clubId,
                SeasonId = seasonId,
                KitNumber = kitNumber,
                ShirtColor = shirtColor,
                ShortsColor = shortsColor,
                SocksColor = socksColor,
            };
        }

        public void UpdateColors(string shirtColor, string shortsColor, string socksColor)
        {
            ShirtColor = shirtColor;
            ShortsColor = shortsColor;
            SocksColor = socksColor;
        }
    }
}
