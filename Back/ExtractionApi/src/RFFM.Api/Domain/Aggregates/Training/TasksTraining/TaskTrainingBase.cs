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

        /// <summary>Optional: the sub-sub-principle this exercise targets.</summary>
        public string? SubSubPrincipleId { get; set; }

        /// <summary>Optional: the sub-principle this exercise targets (mutually exclusive with SubSubPrincipleId/ScenarioId).</summary>
        public string? SubPrincipleId { get; set; }

        /// <summary>Optional: the scenario this exercise targets (mutually exclusive with SubPrincipleId/SubSubPrincipleId).</summary>
        public string? ScenarioId { get; set; }

        /// <summary>Section of the training session: Calentamiento, Principal, VueltaALaCalma.</summary>
        public string Section { get; set; } = "Principal";

        // Fields formerly exclusive to a TPH subclass — merged here since an exercise can now
        // have multiple types at once (Physical, Technical/Tactical fields all coexist).
        public int Series { get; set; }
        public int DurationSeries { get; set; }
        public int RestSeries { get; set; }
        public TimeSpan Time { get; set; } = TimeSpan.Zero;
        public int TouchesNumber { get; set; }
        public int WildCards { get; set; }

        public Club Club { get; set; } = null!;
        public SubSubPrinciple? SubSubPrinciple { get; set; }
        public SubPrinciple? SubPrinciple { get; set; }
        public GameScenario? Scenario { get; set; }
        public List<MaterialsEnum> Material { get; set; } = new();
        public List<TaskTrainingSkill> Skills { get; set; } = new();
        public List<ExerciseCondition> Conditions { get; set; } = new();
        public List<TaskTrainingType> Types { get; set; } = new();
    }
}
