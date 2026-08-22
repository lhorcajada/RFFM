namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// One "X.Y.Z — Rol: acción" sub-item of an <see cref="ExerciseModelRelation"/>, anchored
    /// to a <c>SubSubPrincipio</c> that belongs to the relation's <c>Subprincipio</c>, tagged
    /// FOCO/INTEGRADO independently of the parent relation's own tag. Built only via
    /// <see cref="ExerciseModelRelation.ReplaceItems"/>.
    /// </summary>
    public class ExerciseModelRelationItem : BaseEntity
    {
        public string ExerciseModelRelationId { get; private set; } = null!;
        public string SubSubPrincipioId { get; private set; } = null!;
        public bool IsFoco { get; private set; }

        private ExerciseModelRelationItem() { }

        public ExerciseModelRelationItem(string exerciseModelRelationId, string subSubPrincipioId, bool isFoco)
        {
            if (string.IsNullOrWhiteSpace(exerciseModelRelationId))
                throw new ArgumentException("ExerciseModelRelationId cannot be empty.", nameof(exerciseModelRelationId));
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));

            ExerciseModelRelationId = exerciseModelRelationId;
            SubSubPrincipioId = subSubPrincipioId;
            IsFoco = isFoco;
        }
    }
}
