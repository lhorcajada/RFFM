using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class PointsTypeEnumEntityConfiguration : IEntityTypeConfiguration<PointsTypeEnum>
    {
        public void Configure(EntityTypeBuilder<PointsTypeEnum> builder)
        {
            builder.ToTable("PointsTypes");

            builder.HasKey(pt => pt.Id);

            builder.Property(pt => pt.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasData(PointsTypeEnum.List().Select(pt => new { pt.Id, pt.Name }));
        }
    }
}