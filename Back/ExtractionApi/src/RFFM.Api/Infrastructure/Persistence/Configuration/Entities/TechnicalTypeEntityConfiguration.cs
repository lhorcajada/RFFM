using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Technicals;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TechnicalTypeEntityConfiguration : IEntityTypeConfiguration<TechnicalType>
    {
        public void Configure(EntityTypeBuilder<TechnicalType> builder)
        {
            builder.ToTable("TechnicalTypes");

            builder.Property(tt => tt.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasKey(tt => tt.Id);

          
            builder.HasData(TechnicalType.GetAll());
        }
    }
}
