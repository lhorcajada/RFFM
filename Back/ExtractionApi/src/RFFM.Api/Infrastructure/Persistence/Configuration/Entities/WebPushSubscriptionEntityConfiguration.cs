using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.WebPushNotifications;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class WebPushSubscriptionEntityConfiguration : IEntityTypeConfiguration<WebPushSubscription>
    {
        public void Configure(EntityTypeBuilder<WebPushSubscription> builder)
        {
            builder.ToTable("WebPushSubscriptions");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.UserId).IsRequired();
            builder.Property(p => p.Endpoint).HasMaxLength(1000).IsRequired();
            builder.Property(p => p.P256dhKey).HasMaxLength(500).IsRequired();
            builder.Property(p => p.AuthKey).HasMaxLength(500).IsRequired();
            builder.Property(p => p.CreatedAt).IsRequired();

            builder.HasIndex(p => p.Endpoint).IsUnique();
            builder.HasIndex(p => p.UserId);
        }
    }
}
