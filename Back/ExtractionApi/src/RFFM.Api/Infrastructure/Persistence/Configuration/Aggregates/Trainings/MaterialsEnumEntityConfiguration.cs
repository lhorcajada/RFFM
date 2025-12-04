using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class MaterialsEnumEntityConfiguration : IEntityTypeConfiguration<MaterialsEnum>
    {
        public void Configure(EntityTypeBuilder<MaterialsEnum> builder)
        {
            builder.ToTable("Materials");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasData(MaterialsEnum.List().Select(m => new { m.Id, m.Name }));
        }
    }
}