using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class RffmSeasonPreferenceEntityConfiguration : IEntityTypeConfiguration<RffmSeasonPreference>
    {
        public void Configure(EntityTypeBuilder<RffmSeasonPreference> builder)
        {
            builder.ToTable("RffmSeasonPreferences");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.UserId)
                .IsRequired()
                .HasMaxLength(450);

            builder.Property(c => c.SeasonId)
                .IsRequired();

            builder.HasIndex(c => c.UserId).IsUnique();
        }
    }
}
