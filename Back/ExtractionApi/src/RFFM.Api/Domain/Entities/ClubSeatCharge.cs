namespace RFFM.Api.Domain.Entities
{
    public enum ClubSeatChargeStatus { Pending = 0, Waived = 1 }

    public class ClubSeatCharge
    {
        public int Id { get; set; }
        public string ClubId { get; set; } = string.Empty;
        public string ChargedUserId { get; set; } = string.Empty;
        public int PriceCents { get; set; }
        public DateTime ChargedAt { get; set; }
        public ClubSeatChargeStatus Status { get; set; }
    }
}
