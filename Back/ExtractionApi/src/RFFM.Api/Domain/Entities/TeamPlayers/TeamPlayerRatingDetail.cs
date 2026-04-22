namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerRatingDetail : BaseEntity
    {
        public string RatingId { get; private set; } = null!;

        /// <summary>camelCase characteristic key matching the frontend catalog (e.g. "physicalSpeed").</summary>
        public string CharacteristicKey { get; private set; } = null!;

        /// <summary>Category key: physical | technical | tactical | competitiveness.</summary>
        public string CategoryKey { get; private set; } = null!;

        /// <summary>Selected level 1–10.</summary>
        public int Level { get; private set; }

        /// <summary>Descriptive concept text for the selected level.</summary>
        public string Concept { get; private set; } = null!;

        public TeamPlayerRating Rating { get; private set; } = null!;

        private TeamPlayerRatingDetail() { }

        public static TeamPlayerRatingDetail Create(
            string ratingId,
            string characteristicKey,
            string categoryKey,
            int level,
            string concept)
        {
            if (string.IsNullOrWhiteSpace(characteristicKey))
                throw new ArgumentException("CharacteristicKey must not be empty.", nameof(characteristicKey));
            if (string.IsNullOrWhiteSpace(categoryKey))
                throw new ArgumentException("CategoryKey must not be empty.", nameof(categoryKey));
            if (level < 1 || level > 10)
                throw new ArgumentException($"Level must be between 1 and 10 (was {level}).", nameof(level));
            if (string.IsNullOrWhiteSpace(concept))
                throw new ArgumentException("Concept must not be empty.", nameof(concept));

            return new TeamPlayerRatingDetail
            {
                RatingId = ratingId,
                CharacteristicKey = characteristicKey,
                CategoryKey = categoryKey,
                Level = level,
                Concept = concept,
            };
        }
    }
}
