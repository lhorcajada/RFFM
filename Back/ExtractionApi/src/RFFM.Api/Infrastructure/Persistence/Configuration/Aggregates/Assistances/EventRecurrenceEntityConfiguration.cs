using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class EventRecurrenceEntityConfiguration : IEntityTypeConfiguration<EventRecurrence>
    {
        public void Configure(EntityTypeBuilder<EventRecurrence> builder)
        {
            builder.ToTable("EventRecurrences");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.FrequencyId).IsRequired();
            builder.Property(r => r.EndDate).IsRequired();
            builder.Property(r => r.MasterEventId).IsRequired();
            builder.Property(r => r.InstanceCount).IsRequired();

            builder.HasOne(r => r.MasterEvent)
                .WithMany()
                .HasForeignKey(r => r.MasterEventId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
