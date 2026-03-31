using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class AvailabilityTypeEntityConfiguration : IEntityTypeConfiguration<AvailabilityType>
    {
        public void Configure(EntityTypeBuilder<AvailabilityType> builder)
        {
            builder.ToTable("AvailabilityTypes");

            builder.HasKey(at => at.Id);

            builder.Property(at => at.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasData(
                AvailabilityType.List().Select(at => new { at.Id, at.Name })
            );
        }
    }
}
