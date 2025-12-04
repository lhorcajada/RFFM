using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class ConvocationStatusEntityConfiguration : IEntityTypeConfiguration<ConvocationStatus>
    {
        public void Configure(EntityTypeBuilder<ConvocationStatus> builder)
        {
            builder.ToTable("ConvocationStatuses");

            builder.HasKey(cs => cs.Id);

            builder.Property(cs => cs.Name)
                .IsRequired()
                .HasMaxLength(ValidationAssistancesConstants.MaxNameLength);

            builder.HasData(
                ConvocationStatus.List().Select(cs => new { cs.Id, cs.Name })
            );
        }
    }
}