using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonAccess
{
    internal class SeasonAccessTrialPlayerEntityConfiguration : IEntityTypeConfiguration<SeasonAccessTrialPlayer>
    {
        public void Configure(EntityTypeBuilder<SeasonAccessTrialPlayer> builder)
        {
            builder.ToTable("SeasonAccessTrialPlayers");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.TrialId).IsRequired();
            builder.Property(x => x.FederationPlayerCode).IsRequired().HasMaxLength(50);
            builder.Property(x => x.PlayerName).IsRequired().HasMaxLength(200);
            builder.Property(x => x.TeamCode).IsRequired().HasMaxLength(50);
            builder.Property(x => x.TeamName).IsRequired().HasMaxLength(200);
            builder.Property(x => x.Category).IsRequired().HasMaxLength(50);
            builder.Property(x => x.BirthYear).IsRequired(false);
            builder.Property(x => x.TrialDayId).IsRequired(false);
            builder.Property(x => x.IdealDemarcationId).IsRequired(false);
            builder.Property(x => x.TotalGoals).IsRequired(false);
            builder.Property(x => x.PossibleDemarcationIds).HasColumnType("integer[]");
            builder.Property(x => x.Status).HasMaxLength(50);
            builder.Property(x => x.Notes).HasMaxLength(1000);
            builder.Property(x => x.Score).HasColumnType("decimal(5,2)").IsRequired(false);
            builder.HasIndex(x => new { x.TrialId, x.FederationPlayerCode }).IsUnique();
            builder.HasIndex(x => x.TrialDayId);
            builder.HasIndex(x => x.IdealDemarcationId);

            builder.HasOne(x => x.TrialDay)
                .WithMany(x => x.Players)
                .HasForeignKey(x => x.TrialDayId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}