namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    public class TaskTrainingBase : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int PlayersNumber { get; set; }
        public int GoalPeekersNumber { get; set; }

        public int DurationTotal { get; set; }
        public string FieldSpace { get; set; } = string.Empty;
        public int Points { get; set; }
        public string? UrlImage { get; set; } = string.Empty;

        public List<MaterialsEnum> Material { get; set; } = null!;
    }
}
