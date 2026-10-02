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

        private PlayerSessionEvaluation() { }

        public static PlayerSessionEvaluation Create(
            string teamId,
            string teamPlayerId,
            SessionSnapshot session,
            IEnumerable<SubprincipioEvaluationInput> evaluations,
            string createdByUserId,
            DateOnly today)
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
            evaluation.SetEvaluations(evaluations);
            return evaluation;
        }

        public void ReplaceEvaluations(IEnumerable<SubprincipioEvaluationInput> evaluations, DateOnly today)
        {
            if (SessionDate > today)
                throw new DomainException(Title, "No se puede valorar una sesión que aún no se ha celebrado.", ErrorCodes.SessionNotHeldYet);

            SetEvaluations(evaluations);
            UpdatedAt = DateTime.UtcNow;
        }

        private void SetEvaluations(IEnumerable<SubprincipioEvaluationInput> evaluations)
        {
            var items = (evaluations ?? Enumerable.Empty<SubprincipioEvaluationInput>()).ToList();
            if (items.Count == 0)
                throw new DomainException(Title, "El seguimiento debe valorar al menos un subprincipio.", ErrorCodes.SessionEvaluationEmpty);

            var repeated = items.GroupBy(i => i.Subprincipio.Id).Any(g => g.Count() > 1);
            if (repeated)
                throw new DomainException(Title, "Un subprincipio no se puede valorar dos veces en la misma sesión.",
                    ErrorCodes.SessionEvaluationDuplicatedSubprincipio);

            var created = items.Select(i => SubprincipioEvaluation.Create(Id, i)).ToList();
            _subprincipios.Clear();
            _subprincipios.AddRange(created);
        }

        private static void Require(string value, string name)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException($"{name} cannot be empty.", name);
        }
    }
}
