namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>Etiquetas del Subprincipio en el momento de observar, para que la observación siga
    /// siendo legible aunque el Subprincipio se borre del modelo de juego.</summary>
    public record SubprincipioSnapshot(string Id, string MomentName, string PrincipleLabel, string SubprincipioLabel);

    /// <summary>
    /// Observación del cuerpo técnico sobre cómo responde un jugador a lo que se entrena del modelo de
    /// juego. See openspec/changes/player-tracking-observations-api/design.md → D1.
    /// </summary>
    public class PlayerModelObservation : BaseEntity
    {
        public static class Rules
        {
            public const int CommentMaxLength = 500;
            public const int LabelMaxLength = 300;
        }

        public string TeamPlayerId { get; private set; } = null!;
        public string TeamId { get; private set; } = null!;
        public DateOnly Date { get; private set; }
        public ObservationKind Kind { get; private set; } = null!;
        public string? SubprincipioId { get; private set; }
        public string? MomentName { get; private set; }
        public string? PrincipleLabel { get; private set; }
        public string? SubprincipioLabel { get; private set; }
        public string? AttitudeKey { get; private set; }
        public List<string> Habilidades { get; private set; } = new();
        public string? TrainingSessionId { get; private set; }
        public ObservationAssessment Assessment { get; private set; } = null!;
        public string? Comment { get; private set; }
        public string CreatedByUserId { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        private PlayerModelObservation() { }

        public static PlayerModelObservation ForGameModel(
            string teamPlayerId,
            string teamId,
            DateOnly date,
            SubprincipioSnapshot subprincipio,
            ObservationAssessment assessment,
            string? comment,
            string createdByUserId,
            string? trainingSessionId = null)
        {
            Require(teamPlayerId, nameof(teamPlayerId));
            Require(teamId, nameof(teamId));
            Require(createdByUserId, nameof(createdByUserId));
            ArgumentNullException.ThrowIfNull(subprincipio);
            ArgumentNullException.ThrowIfNull(assessment);
            Require(subprincipio.Id, nameof(subprincipio.Id));
            Require(subprincipio.MomentName, nameof(subprincipio.MomentName));
            Require(subprincipio.PrincipleLabel, nameof(subprincipio.PrincipleLabel));
            Require(subprincipio.SubprincipioLabel, nameof(subprincipio.SubprincipioLabel));

            return new PlayerModelObservation
            {
                TeamPlayerId = teamPlayerId,
                TeamId = teamId,
                Date = date,
                Kind = ObservationKind.GameModel,
                SubprincipioId = subprincipio.Id,
                MomentName = subprincipio.MomentName.Trim(),
                PrincipleLabel = subprincipio.PrincipleLabel.Trim(),
                SubprincipioLabel = subprincipio.SubprincipioLabel.Trim(),
                Assessment = assessment,
                Comment = NormalizeComment(comment),
                TrainingSessionId = string.IsNullOrWhiteSpace(trainingSessionId) ? null : trainingSessionId,
                CreatedByUserId = createdByUserId,
                CreatedAt = DateTime.UtcNow
            };
        }

        public static PlayerModelObservation ForAttitude(
            string teamPlayerId,
            string teamId,
            DateOnly date,
            string attitudeKey,
            ObservationAssessment assessment,
            string? comment,
            string createdByUserId,
            string? trainingSessionId = null)
        {
            Require(teamPlayerId, nameof(teamPlayerId));
            Require(teamId, nameof(teamId));
            Require(createdByUserId, nameof(createdByUserId));
            ArgumentNullException.ThrowIfNull(assessment);
            if (!AttitudeTraits.IsKnown(attitudeKey))
                throw new ArgumentException($"'{attitudeKey}' is not a known attitude trait.", nameof(attitudeKey));

            return new PlayerModelObservation
            {
                TeamPlayerId = teamPlayerId,
                TeamId = teamId,
                Date = date,
                Kind = ObservationKind.Attitude,
                AttitudeKey = attitudeKey,
                Assessment = assessment,
                Comment = NormalizeComment(comment),
                TrainingSessionId = string.IsNullOrWhiteSpace(trainingSessionId) ? null : trainingSessionId,
                CreatedByUserId = createdByUserId,
                CreatedAt = DateTime.UtcNow
            };
        }

        /// <summary>Corrige la valoración y el comentario. Fecha, subprincipio y sesión no cambian:
        /// si están mal, la observación se borra y se registra de nuevo.</summary>
        public void Update(ObservationAssessment assessment, string? comment)
        {
            ArgumentNullException.ThrowIfNull(assessment);
            Comment = NormalizeComment(comment);
            Assessment = assessment;
        }

        private static void Require(string value, string name)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException($"{name} cannot be empty.", name);
        }

        private static string? NormalizeComment(string? comment)
        {
            if (string.IsNullOrWhiteSpace(comment))
                return null;

            var trimmed = comment.Trim();
            if (trimmed.Length > Rules.CommentMaxLength)
                throw new ArgumentException($"Comment cannot exceed {Rules.CommentMaxLength} characters.", nameof(comment));

            return trimmed;
        }
    }
}
