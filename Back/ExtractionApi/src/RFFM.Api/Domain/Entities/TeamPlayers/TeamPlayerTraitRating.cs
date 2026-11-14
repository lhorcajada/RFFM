using RFFM.Api.Domain.PositionFit;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public static class TraitTrend
    {
        public const string Up = "up";
        public const string Same = "same";
        public const string Down = "down";

        public static bool IsValid(string? trend) => trend is Up or Same or Down;
    }

    /// <summary>
    /// Weekly rating of what a field player does in matches, using the common behavior trait catalog
    /// (levels 1–5). Each rating is a snapshot; previous ratings are never modified.
    /// </summary>
    public class TeamPlayerTraitRating : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public DateTime RatedAt { get; private set; }
        public string Trend { get; private set; } = TraitTrend.Same;

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private readonly List<TeamPlayerTraitRatingLevel> _levels = new();
        public IReadOnlyList<TeamPlayerTraitRatingLevel> Levels => _levels.AsReadOnly();

        private TeamPlayerTraitRating() { }

        public static TeamPlayerTraitRating Create(
            string teamPlayerId,
            IReadOnlyList<(string TraitKey, int Level)> levels,
            string? trend = null,
            DateTimeOffset? ratedAt = null)
        {
            var resolvedTrend = trend ?? TraitTrend.Same;
            if (!TraitTrend.IsValid(resolvedTrend))
                throw new ArgumentException($"Trend must be up, same or down (was '{trend}').", nameof(trend));

            var rating = new TeamPlayerTraitRating
            {
                TeamPlayerId = teamPlayerId,
                Trend = resolvedTrend,
                RatedAt = ratedAt.HasValue ? ratedAt.Value.UtcDateTime : DateTime.UtcNow,
            };

            foreach (var (traitKey, level) in levels)
                rating._levels.Add(TeamPlayerTraitRatingLevel.Create(rating.Id, traitKey, level));

            return rating;
        }
    }

    public class TeamPlayerTraitRatingLevel : BaseEntity
    {
        public string RatingId { get; private set; } = null!;
        public string TraitKey { get; private set; } = null!;
        public int Level { get; private set; }

        public TeamPlayerTraitRating Rating { get; private set; } = null!;

        private TeamPlayerTraitRatingLevel() { }

        public static TeamPlayerTraitRatingLevel Create(string ratingId, string traitKey, int level)
        {
            if (!TraitCatalog.IsKnown(traitKey))
                throw new ArgumentException($"Unknown trait '{traitKey}'.", nameof(traitKey));
            if (!TraitCatalog.IsValidLevel(level))
                throw new ArgumentException($"Level must be between {TraitCatalog.MinLevel} and {TraitCatalog.MaxLevel} (was {level}).", nameof(level));

            return new TeamPlayerTraitRatingLevel { RatingId = ratingId, TraitKey = traitKey, Level = level };
        }
    }
}
