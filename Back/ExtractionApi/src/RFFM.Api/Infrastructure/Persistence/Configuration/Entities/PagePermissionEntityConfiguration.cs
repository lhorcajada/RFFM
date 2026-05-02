using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PagePermissionEntityConfiguration : IEntityTypeConfiguration<PagePermission>
    {
        public void Configure(EntityTypeBuilder<PagePermission> builder)
        {
            builder.ToTable("PagePermissions");

            builder.HasKey(pp => pp.Id);
            builder.HasIndex(pp => pp.Id).IsUnique();
            builder.HasIndex(pp => new { pp.RoleName, pp.PageIdentifier, pp.PermissionKey }).IsUnique();

            builder.Property(pp => pp.PageIdentifier)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(pp => pp.PermissionKey)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(pp => pp.RoleName)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(pp => pp.PermissionTypeId)
                .IsRequired();

            builder.Property(pp => pp.IsEditable)
                .IsRequired()
                .HasDefaultValue(false);
        }
    }
}
