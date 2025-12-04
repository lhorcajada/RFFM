using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class SportEventTypeEntityConfiguration : IEntityTypeConfiguration<SportEventType>
    {
        public void Configure(EntityTypeBuilder<SportEventType> builder)
        {
            builder.ToTable("SportEventTypes");

            builder.HasKey(set => set.Id);

            builder.Property(set => set.Name)
                .IsRequired()
                .HasMaxLength(ValidationAssistancesConstants.MaxNameLength);

            builder.HasData(
                SportEventType.List().Select(set => new { set.Id, set.Name })
            );
        }
    }
}