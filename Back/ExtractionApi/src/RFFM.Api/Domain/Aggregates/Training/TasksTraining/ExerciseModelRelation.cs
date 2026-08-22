using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// One "Relación con el modelo de juego" row of an exercise (reduced template §
    /// "Fase — Principio — Subprincipio X.Y — Título"): always anchored to a
    /// <see cref="GameModels.Subprincipio"/> (never a bare SubSubPrincipio, unlike the old
    /// <c>ExerciseModelLink</c>), tagged FOCO/INTEGRADO, and owning its own set of Habilidades
    /// imprescindibles plus a repeatable list of <see cref="ExerciseModelRelationItem"/> rows
    /// (the X.Y.Z "Rol: acción" sub-items).
    /// </summary>
    public class ExerciseModelRelation : BaseEntity
    {
        public string TaskTrainingBaseId { get; private set; } = null!;
        public string SubprincipioId { get; private set; } = null!;
        public bool IsFoco { get; private set; }
        public List<string> HabilidadesImprescindibles { get; private set; } = new();
        public List<ExerciseModelRelationItem> Items { get; private set; } = new();

        private ExerciseModelRelation() { }

        public ExerciseModelRelation(string taskTrainingBaseId, string subprincipioId, bool isFoco,
            IEnumerable<string>? habilidadesImprescindibles)
        {
            if (string.IsNullOrWhiteSpace(taskTrainingBaseId))
                throw new ArgumentException("TaskTrainingBaseId cannot be empty.", nameof(taskTrainingBaseId));
            if (string.IsNullOrWhiteSpace(subprincipioId))
                throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));

            TaskTrainingBaseId = taskTrainingBaseId;
            SubprincipioId = subprincipioId;
            IsFoco = isFoco;
            HabilidadesImprescindibles = ValidateHabilidades(habilidadesImprescindibles);
        }

        /// <summary>Clears and rebuilds <see cref="Items"/> wholesale — same "trust
        /// server-derived state" approach as <see cref="TaskTrainingBase.ReplaceModelRelations"/>.</summary>
        public void ReplaceItems(IEnumerable<(string SubSubPrincipioId, bool IsFoco)> items)
        {
            Items.Clear();
            foreach (var item in items)
                Items.Add(new ExerciseModelRelationItem(Id, item.SubSubPrincipioId, item.IsFoco));
        }

        private static List<string> ValidateHabilidades(IEnumerable<string>? habilidades)
        {
            var list = (habilidades ?? Enumerable.Empty<string>()).ToList();
            foreach (var habilidad in list)
            {
                if (!Habilidad.Vocabulary.Contains(habilidad))
                    throw new ArgumentException(
                        $"'{habilidad}' is not a valid Habilidad name. Must be one of the 15-value closed vocabulary.",
                        nameof(habilidades));
            }
            return list;
        }
    }
}
