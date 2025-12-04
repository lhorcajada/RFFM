namespace RFFM.Api.Domain.Models
{
    public class DemarcationModel
    {
        public List<int>? PossibleDemarcations { get; set; } = null!;
        public int ActivePositionId { get; set; }
    }
}
