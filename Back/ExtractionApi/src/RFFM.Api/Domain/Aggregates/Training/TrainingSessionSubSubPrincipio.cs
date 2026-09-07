namespace RFFM.Api.Domain.Aggregates.Training
{
    /// <summary>
    /// One Sub-subprincipio targeted by a <see cref="TrainingSession"/> — repetition across
    /// sessions is explicitly allowed (progression/repetition), no unique constraint. Built only
    /// via <see cref="TrainingSession.ReplaceTargets"/>. Same cascade-on-ADN-deletion convention
    /// as <c>ExerciseModelRelationItem</c>, per the `season-plan-content-board` OpenSpec change.
    /// </summary>
    public class TrainingSessionSubSubPrincipio : BaseEntity
    {
        public string TrainingSessionId { get; private set; } = null!;
        public string SubSubPrincipioId { get; private set; } = null!;

        private TrainingSessionSubSubPrincipio() { }

        public TrainingSessionSubSubPrincipio(string trainingSessionId, string subSubPrincipioId)
        {
            if (string.IsNullOrWhiteSpace(trainingSessionId))
                throw new ArgumentException("TrainingSessionId cannot be empty.", nameof(trainingSessionId));
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));
            TrainingSessionId = trainingSessionId;
            SubSubPrincipioId = subSubPrincipioId;
        }
    }
}
