using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TrainingSession : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public string Location { get; set; } = string.Empty;
        public string SportEventId { get; set; } = string.Empty;
        public string TeamId { get; set; } = string.Empty;
        public string UrlImage { get; set; } = string.Empty;

        public Team Team { get; set; } = null!;
        public SportEvent SportEvent { get; set; } = null!;
        public List<TaskTraining> Tasks { get; set; } = null!;
    }
}
