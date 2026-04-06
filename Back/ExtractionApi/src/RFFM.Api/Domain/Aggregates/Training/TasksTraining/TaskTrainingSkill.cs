using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// Join entity: links an exercise to a specific essential skill it trains.
    /// One exercise can cover multiple skills of a sub-sub-principle.
    /// </summary>
    public class TaskTrainingSkill
    {
        public string TaskTrainingBaseId { get; set; } = null!;
        public string EssentialSkillId { get; set; } = null!;

        public TaskTrainingBase TaskTrainingBase { get; set; } = null!;
        public EssentialSkill EssentialSkill { get; set; } = null!;
    }
}
