using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonAccess
{
    internal class SeasonAccessTrialEntityConfiguration : IEntityTypeConfiguration<SeasonAccessTrial>
    {
        public void Configure(EntityTypeBuilder<SeasonAccessTrial> builder)
        {
            builder.ToTable("SeasonAccessTrials");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.ApplicationUserId).IsRequired().HasMaxLength(450);
            builder.Property(x => x.SeasonId).IsRequired();
            builder.Property(x => x.Category).IsRequired().HasMaxLength(50);

            builder.HasIndex(x => new { x.ApplicationUserId, x.SeasonId, x.Category }).IsUnique();

            builder.HasMany(x => x.Players)
                .WithOne(x => x.Trial)
                .HasForeignKey(x => x.TrialId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.TrialDays)
                .WithOne(x => x.Trial)
                .HasForeignKey(x => x.TrialId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}