using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Demarcations;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class DemarcationEntityConfiguration : IEntityTypeConfiguration<DemarcationMaster>
    {
        public void Configure(EntityTypeBuilder<DemarcationMaster> builder)
        {
            builder.ToTable("DemarcationMaster");

            builder.Property(cg => cg.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.DemarcationNameMaxLength);

            builder.HasKey(cg => cg.Id);

            builder.HasData(DemarcationMaster.List());
        }
    }
}
