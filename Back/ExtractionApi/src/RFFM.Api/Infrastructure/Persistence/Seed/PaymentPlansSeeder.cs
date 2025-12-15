using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities;
using System.Linq;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    public static class PaymentPlansSeeder
    {
        public static async Task SeedAsync(DbContext context, CancellationToken cancellationToken = default)
        {
            var db = context as RFFM.Api.Infrastructure.Persistence.AppDbContext ?? throw new InvalidOperationException("Invalid context type");

            if (await db.PaymentPlans.AnyAsync(cancellationToken))
                return; // already seeded

            var plans = new PaymentPlan[]
            {
                new PaymentPlan
                {
                    // Free: 7 días free trial. 1 usuario
                    Name = "Free",
                    Description = "7 days free trial",
                    PriceCents = 0,
                    BillingPeriod = BillingPeriodType.OneOff,
                    AllowedClubs = 1,
                    AllowedTeams = 1,
                    AllowedUsers = 1
                },
                new PaymentPlan
                {
                    // Coach: 1 club, 1 equipo, Pago 10€/mes, 1 usuario
                    Name = "Coach",
                    Description = "Coach plan - 1 club, 1 team",
                    PriceCents = 1000,
                    BillingPeriod = BillingPeriodType.Monthly,
                    AllowedClubs = 1,
                    AllowedTeams = 1,
                    AllowedUsers = 1
                },
                new PaymentPlan
                {
                    // Club: 1 club, 60 equipos, Pago 80€/mes, 60 usuarios
                    Name = "Club",
                    Description = "Club plan - 1 club, up to 60 teams",
                    PriceCents = 8000,
                    BillingPeriod = BillingPeriodType.Monthly,
                    AllowedClubs = 1,
                    AllowedTeams = 60,
                    AllowedUsers = 60
                },
                new PaymentPlan
                {
                    // Total: 5 clubes, infinitos equipos (0 = unlimited), Pago anual 3000€, 1000 usuarios
                    Name = "Total",
                    Description = "Enterprise annual one-off - up to 5 clubs and unlimited teams",
                    PriceCents = 300000,
                    BillingPeriod = BillingPeriodType.Yearly,
                    AllowedClubs = 5,
                    AllowedTeams = 0,
                    AllowedUsers = 1000
                }
            };

            db.PaymentPlans.AddRange(plans);
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
