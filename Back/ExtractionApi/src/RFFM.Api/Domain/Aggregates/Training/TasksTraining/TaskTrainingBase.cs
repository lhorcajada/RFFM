using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TaskTrainingBase : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int PlayersNumber { get; set; }
        public int GoalPeekersNumber { get; set; }

        public int DurationTotal { get; set; }
        public string FieldSpace { get; set; } = string.Empty;
        public int Points { get; set; }
        public string? UrlImage { get; set; } = string.Empty;
        public string? BoardStateJson { get; set; }

        /// <summary>Club that owns this exercise (shared library).</summary>
        public string ClubId { get; set; } = string.Empty;

        /// <summary>Section of the training session: Calentamiento, Principal, VueltaALaCalma.</summary>
        public string Section { get; set; } = "Principal";

        /// <summary>Training methodology: Analitico, Integrado, Global.</summary>
        public string Methodology { get; set; } = "Integrado";

        /// <summary>Optional link to the SeasonPlan week (Microciclo) this exercise belongs to.</summary>
        public string? MicrocicloId { get; set; }

        // Fields formerly exclusive to a TPH subclass — merged here since an exercise can now
        // have multiple types at once (Physical, Technical/Tactical fields all coexist).
        public int Series { get; set; }
        public int DurationSeries { get; set; }
        public int RestSeries { get; set; }
        public TimeSpan Time { get; set; } = TimeSpan.Zero;
        public int TouchesNumber { get; set; }
        public int WildCards { get; set; }

        public Club Club { get; set; } = null!;
        public List<MaterialsEnum> Material { get; set; } = new();
        public List<ExerciseCondition> Conditions { get; set; } = new();
        public List<TaskTrainingType> Types { get; set; } = new();

        /// <summary>Habilidad names (closed 15-value vocabulary) this exercise targets — jsonb
        /// column, mirrors <see cref="SeasonPlans.Microciclo.SesionAHabilidades"/> exactly
        /// (design.md Amendment 2).</summary>
        public List<string> Habilidades { get; private set; } = new();

        /// <summary>Which Subprincipio/SubSubPrincipio nodes of the team's current GameModel
        /// this exercise trains, tagged FOCO/INTEGRADO (design.md Amendment 2). A property of
        /// the exercise itself, independent of any one Microciclo/week.</summary>
        public List<ExerciseModelLink> ModelLinks { get; private set; } = new();

        public void UpdateHabilidades(IEnumerable<string>? habilidades) => Habilidades = ValidateHabilidades(habilidades);

        /// <summary>Clears and rebuilds <see cref="ModelLinks"/> wholesale — no incremental
        /// diffing, same "trust server-derived state" approach as
        /// <see cref="SeasonPlans.Microciclo.ReplaceSubprincipioLinks"/>.</summary>
        public void ReplaceModelLinks(IEnumerable<(string? SubprincipioId, string? SubSubPrincipioId, bool IsFoco)> links)
        {
            ModelLinks.Clear();
            foreach (var link in links)
                ModelLinks.Add(new ExerciseModelLink(Id, link.SubprincipioId, link.SubSubPrincipioId, link.IsFoco));
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
