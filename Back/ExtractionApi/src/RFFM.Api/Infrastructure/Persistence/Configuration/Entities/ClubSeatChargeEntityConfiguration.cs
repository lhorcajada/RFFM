using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class ClubSeatChargeEntityConfiguration : IEntityTypeConfiguration<ClubSeatCharge>
    {
        public void Configure(EntityTypeBuilder<ClubSeatCharge> builder)
        {
            builder.ToTable("ClubSeatCharges");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.ClubId).IsRequired();
            builder.Property(c => c.ChargedUserId).IsRequired();
            builder.Property(c => c.PriceCents).IsRequired();
            builder.Property(c => c.ChargedAt).IsRequired();
            builder.Property(c => c.Status).IsRequired();

            builder.HasOne<Club>()
                .WithMany()
                .HasForeignKey(c => c.ClubId);

            builder.HasIndex(c => c.ChargedUserId);
        }
    }
}
