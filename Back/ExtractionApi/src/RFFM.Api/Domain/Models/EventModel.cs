namespace RFFM.Api.Domain.Models
{
    public class EventModel
    {
        public string Name { get; set; } = null!;
        public DateTime EveDateTime { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public DateTime ArrivalDate { get; set; }
        public string Location { get; set; } = null!;
        public string Description { get; set; } = null!;
        public int EventTypeId { get; set; }
        public string TeamId { get; set; } = null!;
        public string RivalId { get; set; } = null!;
    }
}
