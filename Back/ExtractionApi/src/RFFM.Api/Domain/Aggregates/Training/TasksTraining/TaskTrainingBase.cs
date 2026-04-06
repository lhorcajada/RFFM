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

        /// <summary>Club that owns this exercise (shared library).</summary>
        public string ClubId { get; set; } = string.Empty;

        /// <summary>Optional: the sub-sub-principle this exercise targets.</summary>
        public string? SubSubPrincipleId { get; set; }

        /// <summary>Section of the training session: Calentamiento, Principal, VueltaALaCalma.</summary>
        public string Section { get; set; } = "Principal";

        public Club Club { get; set; } = null!;
        public SubSubPrinciple? SubSubPrinciple { get; set; }
        public List<MaterialsEnum> Material { get; set; } = new();
        public List<TaskTrainingSkill> Skills { get; set; } = new();
        public List<ExerciseCondition> Conditions { get; set; } = new();
    }
}
