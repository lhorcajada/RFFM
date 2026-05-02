using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class FeaturePermissionEntityConfiguration : IEntityTypeConfiguration<FeaturePermission>
    {
        public void Configure(EntityTypeBuilder<FeaturePermission> builder)
        {
            builder.ToTable("FeaturePermissions");

            builder.HasKey(fp => fp.Id);
            builder.HasIndex(fp => fp.Id).IsUnique();
            builder.HasIndex(fp => new { fp.RoleName, fp.FeatureRoute }).IsUnique();

            builder.Property(fp => fp.FeatureName)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(fp => fp.FeatureRoute)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(fp => fp.RoleName)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(fp => fp.PermissionTypeId)
                .IsRequired();

            builder.Property(fp => fp.IsEditable)
                .IsRequired()
                .HasDefaultValue(false);
        }
    }
}
