using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class PointsTExcuseTypesEnumEntityConfigurationypeEnumEntityConfiguration : IEntityTypeConfiguration<ExcuseTypes>
    {
        public void Configure(EntityTypeBuilder<ExcuseTypes> builder)
        {
            builder.ToTable("ExcuseTypes");

            builder.HasKey(pt => pt.Id);

            builder.Property(pt => pt.Name)
                .IsRequired()
                .HasMaxLength(100);

            // Include Justified in seeded data
            builder.HasData(ExcuseTypes.List().Select(pt => new { pt.Id, pt.Name, pt.Justified }));
        }
    }
}