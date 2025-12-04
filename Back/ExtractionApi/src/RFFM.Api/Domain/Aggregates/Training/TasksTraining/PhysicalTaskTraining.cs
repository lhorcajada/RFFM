namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class PhysicalTaskTraining : TaskTrainingBase
    {
        public int Series { get; set; }
        public int DurationSeries { get; set; }
        public int RestSeries { get; set; }
        public TimeSpan Time { get; set; } = TimeSpan.Zero;
        
        public PhysicalTaskTraining() { }

    }
}
