namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TaskTraining : BaseEntity
    {
        public int Order { get; set; }

        /// <summary>Section of the session this task belongs to: Calentamiento, Principal, VueltaALaCalma.</summary>
        public string Section { get; set; } = "Principal";

        public string SessionTrainingId { get; set; } = string.Empty;
        public string TaskTrainingBaseId { get; set; } = string.Empty;

        public TaskTrainingBase Task { get; set; } = null!;
        public TrainingSession TrainingSession { get; set; } = null!;

        public TaskTraining() { }
    }
}
