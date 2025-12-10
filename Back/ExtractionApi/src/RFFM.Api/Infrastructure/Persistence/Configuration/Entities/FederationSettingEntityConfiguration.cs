using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class FederationSettingEntityConfiguration : IEntityTypeConfiguration<FederationSetting>
    {
        public void Configure(EntityTypeBuilder<FederationSetting> builder)
        {
            builder.ToTable("FederationSettings");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.UserId)
                .IsRequired()
                .HasMaxLength(450);

            builder.Property(c => c.CompetitionId)
                .HasMaxLength(100);

            builder.Property(c => c.CompetitionName)
                .HasMaxLength(256);

            builder.Property(c => c.GroupId)
                .HasMaxLength(100);

            builder.Property(c => c.GroupName)
                .HasMaxLength(256);

            builder.Property(c => c.TeamId)
                .HasMaxLength(100);

            builder.Property(c => c.TeamName)
                .HasMaxLength(256);

            builder.Property(c => c.CreatedAt)
                .IsRequired();

            builder.Property(c => c.IsPrimary)
                .IsRequired()
                .HasDefaultValue(false);

            builder.HasIndex(c => c.UserId);
            builder.HasIndex(c => new { c.UserId, c.IsPrimary });
        }
    }
}
