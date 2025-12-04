namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TechnicalTaskTraining : TaskTrainingBase
    {
        public int TouchesNumber { get; set; }
        public int WildCards { get; set; }

        public TechnicalTaskTraining() { }

    }
}
