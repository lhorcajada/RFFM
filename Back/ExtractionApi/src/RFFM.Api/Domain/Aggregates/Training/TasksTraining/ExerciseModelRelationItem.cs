using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// One "X.Y.Z — Rol: acción" sub-item of an <see cref="ExerciseModelRelation"/>, anchored
    /// to a <c>SubSubPrincipio</c> that belongs to the relation's <c>Subprincipio</c>, tagged
    /// FOCO/INTEGRADO independently of the parent relation's own tag, and carrying the
    /// Habilidades of that SubSubPrincipio the exercise trains. Built only via
    /// <c>ExerciseModelRelation.ReplaceItems</c>.
    /// </summary>
    public class ExerciseModelRelationItem : BaseEntity
    {
        public string ExerciseModelRelationId { get; private set; } = null!;
        public string SubSubPrincipioId { get; private set; } = null!;
        public bool IsFoco { get; private set; }
        public List<string> Habilidades { get; private set; } = new();

        private ExerciseModelRelationItem() { }

        public ExerciseModelRelationItem(string exerciseModelRelationId, string subSubPrincipioId, bool isFoco,
            IEnumerable<string>? habilidades = null)
        {
            if (string.IsNullOrWhiteSpace(exerciseModelRelationId))
                throw new ArgumentException("ExerciseModelRelationId cannot be empty.", nameof(exerciseModelRelationId));
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));

            ExerciseModelRelationId = exerciseModelRelationId;
            SubSubPrincipioId = subSubPrincipioId;
            IsFoco = isFoco;
            Habilidades = ValidateHabilidades(habilidades);
        }

        private static List<string> ValidateHabilidades(IEnumerable<string>? habilidades)
        {
            var list = (habilidades ?? Enumerable.Empty<string>()).Distinct().ToList();
            foreach (var habilidad in list)
            {
                if (!Habilidad.Vocabulary.Contains(habilidad))
                    throw new ArgumentException(
                        $"'{habilidad}' is not a valid Habilidad name. Must be one of the closed vocabulary.",
                        nameof(habilidades));
            }
            return list;
        }
    }
}
