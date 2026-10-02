namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>Valoración de un subprincipio dentro de un <see cref="PlayerSessionEvaluation"/>.</summary>
    public class SubprincipioEvaluation : BaseEntity
    {
        public static class Rules
        {
            public const int CommentMaxLength = 500;
            public const int LabelMaxLength = 300;
        }

        public string PlayerSessionEvaluationId { get; private set; } = null!;
        public string? SubprincipioId { get; private set; }
        public string MomentName { get; private set; } = null!;
        public string PrincipleLabel { get; private set; } = null!;
        public string SubprincipioLabel { get; private set; } = null!;
        public ObservationAssessment Assessment { get; private set; } = null!;
        public string? Comment { get; private set; }

        private SubprincipioEvaluation() { }

        internal static SubprincipioEvaluation Create(string playerSessionEvaluationId, SubprincipioEvaluationInput input)
        {
            ArgumentNullException.ThrowIfNull(input);
            ArgumentNullException.ThrowIfNull(input.Subprincipio);
            ArgumentNullException.ThrowIfNull(input.Assessment);
            Require(input.Subprincipio.Id, nameof(input.Subprincipio.Id));
            Require(input.Subprincipio.MomentName, nameof(input.Subprincipio.MomentName));
            Require(input.Subprincipio.PrincipleLabel, nameof(input.Subprincipio.PrincipleLabel));
            Require(input.Subprincipio.SubprincipioLabel, nameof(input.Subprincipio.SubprincipioLabel));

            return new SubprincipioEvaluation
            {
                PlayerSessionEvaluationId = playerSessionEvaluationId,
                SubprincipioId = input.Subprincipio.Id,
                MomentName = input.Subprincipio.MomentName.Trim(),
                PrincipleLabel = input.Subprincipio.PrincipleLabel.Trim(),
                SubprincipioLabel = input.Subprincipio.SubprincipioLabel.Trim(),
                Assessment = input.Assessment,
                Comment = NormalizeComment(input.Comment)
            };
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
