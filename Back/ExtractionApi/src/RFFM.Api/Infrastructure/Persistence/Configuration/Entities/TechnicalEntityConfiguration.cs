using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Technicals;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TechnicalEntityConfiguration : IEntityTypeConfiguration<Technical>
    {
        public void Configure(EntityTypeBuilder<Technical> builder)
        {
            builder.ToTable("Technicals");

            builder.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.PlayerNameMaxLength);

            builder.Property(p => p.TechnicalTypeId)
                .IsRequired();


        }
    }
}
