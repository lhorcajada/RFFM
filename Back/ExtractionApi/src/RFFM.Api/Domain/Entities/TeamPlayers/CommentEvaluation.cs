namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public record CommentEvaluationInput(string TrackingCommentId, string Title, ObservationAssessment Assessment, string? Note);

    /// <summary>Valoración de un comentario del catálogo dentro de un <see cref="PlayerSessionEvaluation"/>.</summary>
    public class CommentEvaluation : BaseEntity
    {
        public static class Rules
        {
            public const int NoteMaxLength = 500;
        }

        public string PlayerSessionEvaluationId { get; private set; } = null!;
        public string? TrackingCommentId { get; private set; }
        public string Title { get; private set; } = null!;
        public ObservationAssessment Assessment { get; private set; } = null!;
        public string? Note { get; private set; }

        private CommentEvaluation() { }

        internal static CommentEvaluation Create(string playerSessionEvaluationId, CommentEvaluationInput input)
        {
            ArgumentNullException.ThrowIfNull(input);
            ArgumentNullException.ThrowIfNull(input.Assessment);
            if (string.IsNullOrWhiteSpace(input.TrackingCommentId))
                throw new ArgumentException("TrackingCommentId cannot be empty.", nameof(input));
            if (string.IsNullOrWhiteSpace(input.Title))
                throw new ArgumentException("Title cannot be empty.", nameof(input));

            var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
            if (note?.Length > Rules.NoteMaxLength)
                throw new ArgumentException($"Note cannot exceed {Rules.NoteMaxLength} characters.", nameof(input));

            return new CommentEvaluation
            {
                PlayerSessionEvaluationId = playerSessionEvaluationId,
                TrackingCommentId = input.TrackingCommentId,
                Title = input.Title.Trim(),
                Assessment = input.Assessment,
                Note = note
            };
        }
    }
}
