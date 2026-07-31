using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PushNotifications;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PushTokenEntityConfiguration : IEntityTypeConfiguration<PushToken>
    {
        public void Configure(EntityTypeBuilder<PushToken> builder)
        {
            builder.ToTable("PushTokens");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.UserId).IsRequired();
            builder.Property(p => p.DeviceId).HasMaxLength(200).IsRequired();
            builder.Property(p => p.ExpoPushToken).HasMaxLength(500).IsRequired();
            builder.Property(p => p.Platform).HasMaxLength(20).IsRequired();
            builder.Property(p => p.NewsEnabled).IsRequired();
            builder.Property(p => p.CalendarEnabled).IsRequired();
            builder.Property(p => p.CreatedAt).IsRequired();
            builder.Property(p => p.UpdatedAt).IsRequired();

            builder.HasIndex(p => new { p.UserId, p.DeviceId }).IsUnique();
        }
    }
}
