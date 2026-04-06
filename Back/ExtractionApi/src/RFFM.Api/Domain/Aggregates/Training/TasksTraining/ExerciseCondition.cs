namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class ExerciseCondition
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string TaskTrainingBaseId { get; set; } = null!;
        public string Text { get; set; } = string.Empty;
        public int Order { get; set; }

        public TaskTrainingBase TaskTrainingBase { get; set; } = null!;
    }
}
