namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TacticalTaskTraining : TaskTrainingBase
    {
        public int TouchesNumber { get; set; }
        public int WildCards { get; set; }

        public TacticalTaskTraining() { }

    }
}
