using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class AssistanceTypeEntityConfiguration : IEntityTypeConfiguration<AssistanceType>
    {
        public void Configure(EntityTypeBuilder<AssistanceType> builder)
        {
            builder.ToTable("AssistanceTypes");

            builder.HasKey(at => at.Id);

            builder.Property(at => at.Name)
                .IsRequired()
                .HasMaxLength(ValidationAssistancesConstants.MaxNameLength);

            builder.Property(at => at.Points)
                .IsRequired();

            builder.HasData(
                AssistanceType.List().Select(at => new { at.Id, at.Name, at.Points })
            );
        }
    }
}