namespace RFFM.Api.Domain.Entities.Coaches
{
    public class SeasonPrepPlayerRatingDetail : BaseEntity
    {
        public string RatingId { get; private set; } = null!;
        public string CharacteristicKey { get; private set; } = null!;
        public string CategoryKey { get; private set; } = null!;
        public int Level { get; private set; }
        public string Concept { get; private set; } = null!;

        public SeasonPrepPlayerRating Rating { get; private set; } = null!;

        private SeasonPrepPlayerRatingDetail() { }

        public static SeasonPrepPlayerRatingDetail Create(
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

            return new SeasonPrepPlayerRatingDetail
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