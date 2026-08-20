using System;
using System.Linq;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// Links an exercise (<see cref="TaskTrainingBase"/>) to a concrete <c>Subprincipio</c> or
    /// <c>SubSubPrincipio</c> node from the team's current GameModel, tagged FOCO/INTEGRADO.
    /// A property of the exercise itself — independent of any one Microciclo/week (design.md
    /// Amendment 2). Exactly one of <see cref="SubprincipioId"/>/<see cref="SubSubPrincipioId"/>
    /// must be set, never both/neither — same invariant shape as <see cref="GameModels.SubSubPrincipio"/>'s
    /// own Subprincipio/Zona split. Built only via <see cref="TaskTrainingBase.ReplaceModelLinks"/>,
    /// which always clears and rebuilds the exercise's rows (no incremental diffing).
    /// </summary>
    public class ExerciseModelLink : BaseEntity
    {
        public string TaskTrainingBaseId { get; private set; } = null!;
        public string? SubprincipioId { get; private set; }
        public string? SubSubPrincipioId { get; private set; }
        public bool IsFoco { get; private set; }

        private ExerciseModelLink() { }

        public ExerciseModelLink(string taskTrainingBaseId, string? subprincipioId, string? subSubPrincipioId, bool isFoco)
        {
            if (string.IsNullOrWhiteSpace(taskTrainingBaseId))
                throw new ArgumentException("TaskTrainingBaseId cannot be empty.", nameof(taskTrainingBaseId));

            var parentCount = new[] { subprincipioId, subSubPrincipioId }.Count(id => !string.IsNullOrEmpty(id));
            if (parentCount != 1)
                throw new ArgumentException("Exactly one of SubprincipioId or SubSubPrincipioId must be set.");

            TaskTrainingBaseId = taskTrainingBaseId;
            SubprincipioId = subprincipioId;
            SubSubPrincipioId = subSubPrincipioId;
            IsFoco = isFoco;
        }
    }
}
