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
            builder.Property(x => x.IdealDemarcationId).IsRequired(false);
            builder.Property(x => x.TotalGoals).IsRequired(false);
            builder.Property(x => x.PossibleDemarcationIds).HasColumnType("integer[]");

            builder.HasIndex(x => new { x.TrialId, x.FederationPlayerCode }).IsUnique();
            builder.HasIndex(x => x.IdealDemarcationId);
        }
    }
}