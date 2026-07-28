using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Records a player's participation in a real match (partido en directo).
    /// One record per player per sport event, upserted when the match ends.
    /// </summary>
    public class MatchParticipation : BaseEntity
    {
        public string EventId { get; private set; } = null!;
        public string TeamId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;

        /// <summary>Total minutes played in the match.</summary>
        public int MinutesPlayed { get; private set; }

        /// <summary>True if the player started the match in the initial lineup.</summary>
        public bool IsStarter { get; private set; }

        /// <summary>Match minute at which the player entered the field (0 for starters).</summary>
        public int? EnteredAtMinute { get; private set; }

        /// <summary>Match minute at which the player exited the field. Null if played until the end.</summary>
        public int? ExitedAtMinute { get; private set; }

        /// <summary>Serialised JSON array of SubstitutionWindow objects executed during the match.</summary>
        public string? SubstitutionWindowsJson { get; private set; }

        /// <summary>Serialised JSON array of WindowRatingSnapshot objects captured per window.</summary>
        public string? RatingSnapshotsJson { get; private set; }

        /// <summary>Serialised JSON array of GoalEvent objects scored during the match.</summary>
        public string? GoalsJson { get; private set; }

        /// <summary>Serialised JSON array of CardEvent(TeamPlayerId, CardType) objects issued during the match.</summary>
        public string? CardsJson { get; private set; }

        /// <summary>Home team goals at end of match.</summary>
        public int ScoreLocal { get; private set; }

        /// <summary>Away team goals at end of match.</summary>
        public int ScoreVisitor { get; private set; }

        /// <summary>Phase of the match when data was saved (e.g. "finished").</summary>
        public string MatchPhase { get; private set; } = "finished";

        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        protected MatchParticipation() { }

        public static MatchParticipation Create(
            string eventId,
            string teamId,
            string teamPlayerId,
            int minutesPlayed,
            bool isStarter,
            int? enteredAtMinute,
            int? exitedAtMinute,
            int scoreLocal,
            int scoreVisitor,
            string matchPhase,
            string? substitutionWindowsJson,
            string? ratingSnapshotsJson,
            string? goalsJson,
            string? cardsJson = null)
        {
            var now = DateTime.UtcNow;
            return new MatchParticipation
            {
                EventId = eventId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                MinutesPlayed = minutesPlayed,
                IsStarter = isStarter,
                EnteredAtMinute = enteredAtMinute,
                ExitedAtMinute = exitedAtMinute,
                ScoreLocal = scoreLocal,
                ScoreVisitor = scoreVisitor,
                MatchPhase = matchPhase,
                SubstitutionWindowsJson = substitutionWindowsJson,
                RatingSnapshotsJson = ratingSnapshotsJson,
                GoalsJson = goalsJson,
                CardsJson = cardsJson,
                CreatedAt = now,
                UpdatedAt = now,
            };
        }

        public void Update(
            int minutesPlayed,
            bool isStarter,
            int? enteredAtMinute,
            int? exitedAtMinute,
            int scoreLocal,
            int scoreVisitor,
            string matchPhase,
            string? substitutionWindowsJson,
            string? ratingSnapshotsJson,
            string? goalsJson,
            string? cardsJson = null)
        {
            MinutesPlayed = minutesPlayed;
            IsStarter = isStarter;
            EnteredAtMinute = enteredAtMinute;
            ExitedAtMinute = exitedAtMinute;
            ScoreLocal = scoreLocal;
            ScoreVisitor = scoreVisitor;
            MatchPhase = matchPhase;
            SubstitutionWindowsJson = substitutionWindowsJson;
            RatingSnapshotsJson = ratingSnapshotsJson;
            GoalsJson = goalsJson;
            CardsJson = cardsJson;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
