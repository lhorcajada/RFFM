using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PaymentPlanEntityConfiguration : IEntityTypeConfiguration<PaymentPlan>
    {
        public void Configure(EntityTypeBuilder<PaymentPlan> builder)
        {
            builder.ToTable("PaymentPlans");

            builder.HasKey(pp => pp.Id);

            builder.Property(pp => pp.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(pp => pp.Description)
                .HasMaxLength(1000)
                .IsRequired(false);

            builder.Property(pp => pp.PriceCents)
                .IsRequired();

            // Enum stored as int by default
            builder.Property(pp => pp.BillingPeriod)
                .IsRequired();

            builder.Property(pp => pp.AllowedClubs)
                .IsRequired();

            builder.Property(pp => pp.AllowedTeams)
                .IsRequired();

            builder.Property(pp => pp.AllowedUsers)
                .IsRequired();

            builder.HasIndex(pp => pp.Name).IsUnique(false);
        }
    }
}
