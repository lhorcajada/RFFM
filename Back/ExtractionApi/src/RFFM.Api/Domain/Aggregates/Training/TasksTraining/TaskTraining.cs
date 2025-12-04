namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TaskTraining : BaseEntity
    {
        public int Order { get; set; }
        public string SessionTrainingId { get; set; } = string.Empty;

        public TaskTrainingBase Task { get; set; } = null!;
        public TrainingSession TrainingSession { get; set; } = null!;

        public TaskTraining() { }

    }
}
