using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Domain.Aggregates.Training
{
    /// <summary>
    /// One exercise placed inside a <see cref="SessionBlock"/>, at a given <see cref="Position"/>.
    /// Two or more rows in the same block, at different positions, represent exercises running
    /// "en paralelo" — the frontend renders them side by side; there is no separate "lane"
    /// concept on the backend. Replaces the old flat <c>TaskTraining</c> Session↔Exercise join.
    /// Built only via <see cref="SessionBlock.ReplaceExercises"/>.
    /// </summary>
    public class SessionBlockExercise : BaseEntity
    {
        public string SessionBlockId { get; private set; } = null!;
        public string TaskTrainingBaseId { get; private set; } = null!;
        public int Position { get; private set; }

        public TaskTrainingBase Exercise { get; private set; } = null!;

        private SessionBlockExercise() { }

        public SessionBlockExercise(string sessionBlockId, string taskTrainingBaseId, int position)
        {
            if (string.IsNullOrWhiteSpace(sessionBlockId))
                throw new ArgumentException("SessionBlockId cannot be empty.", nameof(sessionBlockId));
            if (string.IsNullOrWhiteSpace(taskTrainingBaseId))
                throw new ArgumentException("TaskTrainingBaseId cannot be empty.", nameof(taskTrainingBaseId));

            SessionBlockId = sessionBlockId;
            TaskTrainingBaseId = taskTrainingBaseId;
            Position = position;
        }
    }
}
