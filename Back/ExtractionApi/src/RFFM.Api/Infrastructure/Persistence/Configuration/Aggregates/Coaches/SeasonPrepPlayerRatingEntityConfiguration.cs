using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Coaches
{
    internal class SeasonPrepPlayerRatingEntityConfiguration : IEntityTypeConfiguration<SeasonPrepPlayerRating>
    {
        public void Configure(EntityTypeBuilder<SeasonPrepPlayerRating> builder)
        {
            builder.ToTable("SeasonPrepPlayerRatings");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.UserId).IsRequired();
            builder.Property(r => r.FedSeason).IsRequired().HasMaxLength(10);
            builder.Property(r => r.SportEventId).IsRequired(false).HasMaxLength(50);
            builder.Property(r => r.SeasonPrepPlayerId).IsRequired();

            builder.Property(r => r.Technical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Tactical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Physical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Competitiveness).IsRequired().HasColumnType("decimal(5,1)");

            builder.Property(r => r.PhysicalSpeed).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.PhysicalEndurance).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.PhysicalStrength).IsRequired(false).HasColumnType("decimal(5,1)");

            builder.Property(r => r.TechnicalDribbling).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalPassing).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalControl).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalShooting).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalTackling).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalInterceptions).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalHeading).IsRequired(false).HasColumnType("decimal(5,1)");

            builder.Property(r => r.TacticalDefensiveAwareness).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalMarking).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalTrackBack).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalPressing).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalGeneratesAdvantage).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalOffMovement).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalBeatsOpponents).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalAttackParticipation).IsRequired(false).HasColumnType("decimal(5,1)");

            builder.Property(r => r.CompetDuelWinning).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetLooseBalls).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetRecoveries).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetDecisiveActions).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetResponsibility).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetConstantEffort).IsRequired(false).HasColumnType("decimal(5,1)");

            builder.Property(r => r.IsGoalkeeper).IsRequired().HasDefaultValue(false);
            builder.Property(r => r.RatedAt).IsRequired();
            builder.Property(r => r.Notes).IsRequired(false).HasMaxLength(500);

            builder.HasIndex(r => new { r.UserId, r.FedSeason, r.SportEventId, r.SeasonPrepPlayerId }).IsUnique();
            builder.HasIndex(r => r.RatedAt);

            builder.Navigation(r => r.Details)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasField("_details");
        }
    }
}