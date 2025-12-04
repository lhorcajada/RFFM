using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;

namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TrainingPointsReport: BaseEntity
    {
        public int TotalPoints { get; set; }
        public int TrainingNumber { get; set; }
        public int AssistancePoint { get; set; }
        public int TecnicalPoints { get; set; }
        public int AttitudePoints { get; set; }
        public int TacticalPoints { get; set; }
        public int PhysicalPoints { get; set; }
        public string PlayerId { get; set; } = null!;
        public string SeasonId { get; set; }

        public Player Player { get; set; } = null!;
        public Season Season { get; set; } = null!;
    
    }
}
