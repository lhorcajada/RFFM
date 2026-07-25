namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>Join entity: an exercise can have 1..N exercise types (Físico, Técnico, ...).</summary>
    public class TaskTrainingType
    {
        public string TaskTrainingBaseId { get; set; } = null!;
        public string ExerciseTypeId { get; set; } = null!;

        public TaskTrainingBase TaskTrainingBase { get; set; } = null!;
        public ExerciseType ExerciseType { get; set; } = null!;
    }
}
