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
    }
}
