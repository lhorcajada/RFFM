using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// An exercise ("Ejercicio"), club-owned shared library item, following the reduced content
    /// template in <c>docs/game-model/Plantilla-Ejercicio.md</c>. See design.md §1.1 of the
    /// `session-exercise-plan-redesign` OpenSpec change for the full field-by-field rationale.
    /// </summary>
    public class TaskTrainingBase : BaseEntity
    {
        /// <summary>The three allowed <see cref="Tipo"/> values, per the reduced template.</summary>
        public static readonly IReadOnlySet<string> TipoValues = new HashSet<string> { "Analitico", "Situacional", "Global" };

        /// <summary>Título.</summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>Analitico | Situacional | Global.</summary>
        public string Tipo { get; set; } = "Analitico";

        public string Objetivo { get; set; } = string.Empty;
        public string? ObjetivoPorRol { get; set; }

        public string Logistica { get; set; } = string.Empty;
        public int? DurationMinutes { get; set; }
        public string? Porteros { get; set; }
        public string? Dibujo { get; set; }
        public string Descripcion { get; set; } = string.Empty;

        public string? UrlImage { get; set; } = string.Empty;
        public string? BoardStateJson { get; set; }

        /// <summary>Club that owns this exercise (shared library).</summary>
        public string ClubId { get; set; } = string.Empty;

        public Club Club { get; set; } = null!;

        public List<string> NivelesColumnas { get; private set; } = new();
        public List<ExerciseLevelRow> Niveles { get; private set; } = new();

        public List<ExerciseModelRelation> ModelRelations { get; private set; } = new();

        /// <summary>Clears and rebuilds <see cref="ModelRelations"/> wholesale — no incremental
        /// diffing, same "trust server-derived state" approach used across this codebase (e.g.
        /// the old <c>ReplaceModelLinks</c>).</summary>
        public void ReplaceModelRelations(
            IEnumerable<(string SubprincipioId, bool IsFoco, IEnumerable<string>? Habilidades,
                IEnumerable<(string SubSubPrincipioId, bool IsFoco)> Items)> relations)
        {
            ModelRelations.Clear();
            foreach (var relation in relations)
            {
                var entity = new ExerciseModelRelation(Id, relation.SubprincipioId, relation.IsFoco, relation.Habilidades);
                entity.ReplaceItems(relation.Items);
                ModelRelations.Add(entity);
            }
        }

        /// <summary>
        /// Validates and replaces <see cref="NivelesColumnas"/>/<see cref="Niveles"/>. Invariants
        /// (design.md §1.3): 2-5 rows, <see cref="ExerciseLevelRow.Nivel"/> numbered 1..N with no
        /// gaps/duplicates, and every row's cell keys must be a subset of <paramref name="columnas"/>
        /// (no orphan cells).
        /// </summary>
        public void UpdateNiveles(IEnumerable<string> columnas, IEnumerable<ExerciseLevelRow> niveles)
        {
            var columnasList = (columnas ?? Enumerable.Empty<string>()).ToList();
            var nivelesList = (niveles ?? Enumerable.Empty<ExerciseLevelRow>()).ToList();

            if (nivelesList.Count is < 2 or > 5)
                throw new ArgumentException("Niveles must have between 2 and 5 rows.", nameof(niveles));

            var expectedNumbers = Enumerable.Range(1, nivelesList.Count).ToHashSet();
            var actualNumbers = nivelesList.Select(n => n.Nivel).ToList();
            if (actualNumbers.Distinct().Count() != actualNumbers.Count || !actualNumbers.All(expectedNumbers.Contains))
                throw new ArgumentException("Niveles must be numbered 1..N contiguously, with no gaps or duplicates.", nameof(niveles));

            var columnSet = columnasList.ToHashSet();
            foreach (var row in nivelesList)
            {
                if (row.Valores.Keys.Any(k => !columnSet.Contains(k)))
                    throw new ArgumentException("A Nivel row references a palanca column that is not in NivelesColumnas.", nameof(niveles));
            }

            NivelesColumnas = columnasList;
            Niveles = nivelesList;
        }
    }
}
