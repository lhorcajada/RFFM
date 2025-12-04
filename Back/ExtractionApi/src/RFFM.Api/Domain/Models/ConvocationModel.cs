namespace RFFM.Api.Domain.Models
{
    public class ConvocationModel
    {
        public string EventId { get; set; } = null!;
        public string TeamPlayerId { get; set; } = null!;
        public int AssistanceTypeId { get; set; }
        public DateTime ResponseDateTime { get; set; }
        public int? ConvocationStatusId { get; set; }
        public int? ExcuseTypeId { get; set; }

    }
}
