using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class ClubKitEntityConfiguration : IEntityTypeConfiguration<ClubKit>
    {
        public void Configure(EntityTypeBuilder<ClubKit> builder)
        {
            builder.ToTable("ClubKits");
            builder.HasKey(k => k.Id);

            builder.Property(k => k.ClubId).IsRequired();
            builder.Property(k => k.SeasonId).IsRequired();
            builder.Property(k => k.KitNumber).IsRequired();
            builder.Property(k => k.ShirtColor).IsRequired().HasMaxLength(7);
            builder.Property(k => k.ShortsColor).IsRequired().HasMaxLength(7);
            builder.Property(k => k.SocksColor).IsRequired().HasMaxLength(7);

            builder.HasIndex(k => new { k.ClubId, k.SeasonId, k.KitNumber }).IsUnique();

            builder.HasOne(k => k.Club)
                .WithMany()
                .HasForeignKey(k => k.ClubId);

            builder.HasOne(k => k.Season)
                .WithMany()
                .HasForeignKey(k => k.SeasonId);
        }
    }
}
