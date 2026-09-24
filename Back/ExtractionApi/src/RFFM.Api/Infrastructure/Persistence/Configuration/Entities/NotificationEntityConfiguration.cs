using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.WebPushNotifications;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class NotificationEntityConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> builder)
        {
            builder.ToTable("Notifications");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.UserId).IsRequired();
            builder.Property(p => p.Type).HasMaxLength(50).IsRequired();
            builder.Property(p => p.Title).HasMaxLength(200).IsRequired();
            builder.Property(p => p.Body).HasMaxLength(1000).IsRequired();
            builder.Property(p => p.DeepLinkPath).HasMaxLength(500);
            builder.Property(p => p.IsRead).IsRequired();
            builder.Property(p => p.CreatedAt).IsRequired();

            builder.HasIndex(p => new { p.UserId, p.CreatedAt });
        }
    }
}
