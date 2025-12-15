using System.ComponentModel.DataAnnotations;

namespace RFFM.Api.Domain.Entities
{
    public class PaymentPlan
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        // Price in cents (or minor currency unit)
        public int PriceCents { get; set; }

        // Monthly or yearly indicator
        public BillingPeriodType BillingPeriod { get; set; } = BillingPeriodType.Monthly;

        // Number of allowed clubs (0 = unlimited)
        public int AllowedClubs { get; set; }

        // Number of allowed teams (0 = unlimited)
        public int AllowedTeams { get; set; }

        // Number of allowed users (0 = unlimited)
        public int AllowedUsers { get; set; }
    }
}
