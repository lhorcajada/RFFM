namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>Nombre y fecha de la sesión en el momento de valorar: el seguimiento sobrevive si la sesión se borra.</summary>
    public record SessionSnapshot(string Id, string Name, DateOnly Date);

    public record SubprincipioEvaluationInput(SubprincipioSnapshot Subprincipio, ObservationAssessment Assessment, string? Comment);

    /// <summary>
    /// Seguimiento de un jugador en una sesión de entrenamiento: una valoración por cada subprincipio
    /// trabajado en ella. Uno por jugador y sesión.
    /// See openspec/changes/player-session-evaluation-api/design.md → D1.
    /// </summary>
    public class PlayerSessionEvaluation : BaseEntity
    {
        private const string Title = "Seguimiento";

        public string TeamId { get; private set; } = null!;
        public string TeamPlayerId { get; private set; } = null!;
        public string? TrainingSessionId { get; private set; }
        public string SessionName { get; private set; } = null!;
        public DateOnly SessionDate { get; private set; }
        public string CreatedByUserId { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        private readonly List<SubprincipioEvaluation> _subprincipios = new();
        public IReadOnlyCollection<SubprincipioEvaluation> Subprincipios => _subprincipios.AsReadOnly();

        private readonly List<CommentEvaluation> _comments = new();
        public IReadOnlyCollection<CommentEvaluation> Comments => _comments.AsReadOnly();

        private PlayerSessionEvaluation() { }

        public static PlayerSessionEvaluation Create(
            string teamId,
            string teamPlayerId,
            SessionSnapshot session,
            IEnumerable<SubprincipioEvaluationInput> evaluations,
            string createdByUserId,
            DateOnly today,
            IEnumerable<CommentEvaluationInput>? comments = null)
        {
            Require(teamId, nameof(teamId));
            Require(teamPlayerId, nameof(teamPlayerId));
            Require(createdByUserId, nameof(createdByUserId));
            ArgumentNullException.ThrowIfNull(session);
            Require(session.Id, nameof(session.Id));
            Require(session.Name, nameof(session.Name));
            if (session.Date > today)
                throw new DomainException(Title, "No se puede valorar una sesión que aún no se ha celebrado.", ErrorCodes.SessionNotHeldYet);

            var now = DateTime.UtcNow;
            var evaluation = new PlayerSessionEvaluation
            {
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                TrainingSessionId = session.Id,
                SessionName = session.Name.Trim(),
                SessionDate = session.Date,
                CreatedByUserId = createdByUserId,
                CreatedAt = now,
                UpdatedAt = now
            };
            evaluation.SetEvaluations(evaluations, comments);
            return evaluation;
        }

        public void ReplaceEvaluations(
            IEnumerable<SubprincipioEvaluationInput> evaluations, DateOnly today, IEnumerable<CommentEvaluationInput>? comments = null)
        {
            if (SessionDate > today)
                throw new DomainException(Title, "No se puede valorar una sesión que aún no se ha celebrado.", ErrorCodes.SessionNotHeldYet);

            SetEvaluations(evaluations, comments);
            UpdatedAt = DateTime.UtcNow;
        }

        private void SetEvaluations(IEnumerable<SubprincipioEvaluationInput> evaluations, IEnumerable<CommentEvaluationInput>? comments)
        {
            var items = (evaluations ?? Enumerable.Empty<SubprincipioEvaluationInput>()).ToList();
            var commentItems = (comments ?? Enumerable.Empty<CommentEvaluationInput>()).ToList();
            if (items.Count == 0 && commentItems.Count == 0)
                throw new DomainException(Title, "El seguimiento debe valorar al menos un subprincipio o un comentario.",
                    ErrorCodes.SessionEvaluationEmpty);

            var repeatedComment = commentItems.GroupBy(c => c.TrackingCommentId).Any(g => g.Count() > 1);
            if (repeatedComment)
                throw new DomainException(Title, "Un comentario no se puede valorar dos veces en la misma sesión.",
                    ErrorCodes.SessionEvaluationDuplicatedComment);

            var repeated = items.GroupBy(i => i.Subprincipio.Id).Any(g => g.Count() > 1);
            if (repeated)
                throw new DomainException(Title, "Un subprincipio no se puede valorar dos veces en la misma sesión.",
                    ErrorCodes.SessionEvaluationDuplicatedSubprincipio);

            var created = items.Select(i => SubprincipioEvaluation.Create(Id, i)).ToList();
            var createdComments = commentItems.Select(c => CommentEvaluation.Create(Id, c)).ToList();
            _subprincipios.Clear();
            _subprincipios.AddRange(created);
            _comments.Clear();
            _comments.AddRange(createdComments);
        }

        private static void Require(string value, string name)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException($"{name} cannot be empty.", name);
        }
    }
}
