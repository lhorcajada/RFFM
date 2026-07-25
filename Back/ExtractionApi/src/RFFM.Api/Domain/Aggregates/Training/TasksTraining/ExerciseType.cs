namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class ExerciseType : BaseEntity
    {
        public string Name { get; private set; } = string.Empty;

        protected ExerciseType() { }

        public static ExerciseType Create(string name) => new() { Name = name };
    }
}
