namespace RFFM.Api.Domain.Entities.Coaches
{
    public class SeasonPrepPlayerRating : BaseEntity
    {
        private static decimal RoundUpToSingleDecimal(decimal value) => Math.Ceiling(value * 10m) / 10m;

        public string UserId { get; private set; } = null!;
        public string FedSeason { get; private set; } = null!;
        public string? SportEventId { get; private set; }
        public string SeasonPrepPlayerId { get; private set; } = null!;

        public decimal Technical { get; private set; }
        public decimal Tactical { get; private set; }
        public decimal Physical { get; private set; }
        public decimal Competitiveness { get; private set; }

        public decimal? PhysicalSpeed { get; private set; }
        public decimal? PhysicalEndurance { get; private set; }
        public decimal? PhysicalStrength { get; private set; }

        public decimal? TechnicalDribbling { get; private set; }
        public decimal? TechnicalPassing { get; private set; }
        public decimal? TechnicalControl { get; private set; }
        public decimal? TechnicalShooting { get; private set; }
        public decimal? TechnicalTackling { get; private set; }
        public decimal? TechnicalInterceptions { get; private set; }
        public decimal? TechnicalHeading { get; private set; }

        public decimal? TacticalDefensiveAwareness { get; private set; }
        public decimal? TacticalMarking { get; private set; }
        public decimal? TacticalTrackBack { get; private set; }
        public decimal? TacticalPressing { get; private set; }
        public decimal? TacticalGeneratesAdvantage { get; private set; }
        public decimal? TacticalOffMovement { get; private set; }
        public decimal? TacticalBeatsOpponents { get; private set; }
        public decimal? TacticalAttackParticipation { get; private set; }

        public decimal? CompetDuelWinning { get; private set; }
        public decimal? CompetLooseBalls { get; private set; }
        public decimal? CompetRecoveries { get; private set; }
        public decimal? CompetDecisiveActions { get; private set; }
        public decimal? CompetResponsibility { get; private set; }
        public decimal? CompetConstantEffort { get; private set; }

        public bool IsGoalkeeper { get; private set; }
        public DateTime RatedAt { get; private set; }
        public string? Notes { get; private set; }

        private readonly List<SeasonPrepPlayerRatingDetail> _details = new();
        public IReadOnlyList<SeasonPrepPlayerRatingDetail> Details => _details.AsReadOnly();

        private SeasonPrepPlayerRating() { }

        public static SeasonPrepPlayerRating CreateConceptual(
            string userId,
            string fedSeason,
            string? sportEventId,
            string seasonPrepPlayerId,
            bool isGoalkeeper,
            IReadOnlyList<(string CharacteristicKey, string CategoryKey, int Level, string Concept)> answers,
            string? notes = null,
            DateTimeOffset? ratedAt = null)
        {
            if (string.IsNullOrWhiteSpace(userId))
                throw new ArgumentException("UserId must not be empty.", nameof(userId));
            if (string.IsNullOrWhiteSpace(fedSeason))
                throw new ArgumentException("FedSeason must not be empty.", nameof(fedSeason));
            if (sportEventId is not null && string.IsNullOrWhiteSpace(sportEventId))
                throw new ArgumentException("SportEventId must not be empty when provided.", nameof(sportEventId));
            if (string.IsNullOrWhiteSpace(seasonPrepPlayerId))
                throw new ArgumentException("SeasonPrepPlayerId must not be empty.", nameof(seasonPrepPlayerId));
            if (answers == null || answers.Count == 0)
                throw new ArgumentException("At least one conceptual answer is required.", nameof(answers));

            foreach (var a in answers)
            {
                if (string.IsNullOrWhiteSpace(a.CharacteristicKey))
                    throw new ArgumentException("CharacteristicKey must not be empty.");
                if (string.IsNullOrWhiteSpace(a.CategoryKey))
                    throw new ArgumentException("CategoryKey must not be empty.");
                if (a.Level < 1 || a.Level > 10)
                    throw new ArgumentException($"Level must be 1–10 (was {a.Level} for '{a.CharacteristicKey}').");
                if (string.IsNullOrWhiteSpace(a.Concept))
                    throw new ArgumentException($"Concept must not be empty for '{a.CharacteristicKey}'.");
            }

            static decimal AvgForCategory(
                IReadOnlyList<(string CharacteristicKey, string CategoryKey, int Level, string Concept)> list,
                string cat)
            {
                var levels = list.Where(a => a.CategoryKey == cat).Select(a => (decimal)a.Level).ToList();
                return levels.Count == 0 ? 0m : RoundUpToSingleDecimal(levels.Average());
            }

            var rating = new SeasonPrepPlayerRating
            {
                UserId = userId,
                FedSeason = fedSeason,
                SportEventId = sportEventId,
                SeasonPrepPlayerId = seasonPrepPlayerId,
                IsGoalkeeper = isGoalkeeper,
                Physical = AvgForCategory(answers, "physical"),
                Technical = AvgForCategory(answers, "technical"),
                Tactical = AvgForCategory(answers, "tactical"),
                Competitiveness = AvgForCategory(answers, "competitiveness"),
                RatedAt = ratedAt.HasValue ? ratedAt.Value.UtcDateTime : DateTime.UtcNow,
                Notes = notes,
            };

            foreach (var a in answers)
            {
                rating._details.Add(SeasonPrepPlayerRatingDetail.Create(
                    rating.Id,
                    a.CharacteristicKey,
                    a.CategoryKey,
                    a.Level,
                    a.Concept));
            }

            return rating;
        }
    }
}