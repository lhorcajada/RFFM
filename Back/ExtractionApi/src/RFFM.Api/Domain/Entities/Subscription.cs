using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RFFM.Api.Domain.Entities
{
    public enum SubscriptionStatus
    {
        Pending = 0,
        Active = 1,
        Cancelled = 2,
        Expired = 3
    }

    public class Subscription
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;

        [ForeignKey("PaymentPlan")]
        public int PaymentPlanId { get; set; }
        public PaymentPlan? PaymentPlan { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
