using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SubscriptionEntityConfiguration : IEntityTypeConfiguration<Subscription>
    {
        public void Configure(EntityTypeBuilder<Subscription> builder)
        {
            builder.ToTable("Subscriptions");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.UserId)
                .IsRequired()
                .HasMaxLength(450);

            builder.Property(s => s.PaymentPlanId)
                .IsRequired();

            builder.Property(s => s.StartDate)
                .IsRequired();

            builder.Property(s => s.EndDate)
                .IsRequired();

            builder.Property(s => s.Status)
                .IsRequired();

            builder.Property(s => s.CreatedAt)
                .IsRequired();

            builder.HasOne(s => s.PaymentPlan)
                .WithMany()
                .HasForeignKey(s => s.PaymentPlanId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(s => s.UserId);
            builder.HasIndex(s => s.PaymentPlanId);
        }
    }
}
