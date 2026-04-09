using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerRatingEntityConfiguration : IEntityTypeConfiguration<TeamPlayerRating>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerRating> builder)
        {
            builder.ToTable("TeamPlayerRatings");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.TeamPlayerId).IsRequired();

            // Computed aggregates
            builder.Property(r => r.Technical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Tactical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Physical).IsRequired().HasColumnType("decimal(5,1)");
            builder.Property(r => r.Competitiveness).IsRequired().HasColumnType("decimal(5,1)");

            // Physical sub-ratings
            builder.Property(r => r.PhysicalSpeed).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.PhysicalEndurance).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.PhysicalStrength).IsRequired(false).HasColumnType("decimal(5,1)");

            // Technical sub-ratings
            builder.Property(r => r.TechnicalDribbling).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalPassing).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalControl).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalShooting).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalTackling).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalInterceptions).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TechnicalHeading).IsRequired(false).HasColumnType("decimal(5,1)");

            // Tactical sub-ratings
            builder.Property(r => r.TacticalDefensiveAwareness).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalMarking).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalTrackBack).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalPressing).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalGeneratesAdvantage).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalOffMovement).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalBeatsOpponents).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.TacticalAttackParticipation).IsRequired(false).HasColumnType("decimal(5,1)");

            // Competitiveness sub-ratings
            builder.Property(r => r.CompetDuelWinning).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetLooseBalls).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetRecoveries).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetDecisiveActions).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetResponsibility).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.CompetConstantEffort).IsRequired(false).HasColumnType("decimal(5,1)");

            // Goalkeeper flag
            builder.Property(r => r.IsGoalkeeper).IsRequired().HasDefaultValue(false);

            // Goalkeeper Physical sub-ratings
            builder.Property(r => r.KeeperReactionSpeed).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperAgility).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperJumpPower).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperStrength).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperEndurance).IsRequired(false).HasColumnType("decimal(5,1)");

            // Goalkeeper Technical sub-ratings
            builder.Property(r => r.KeeperHandSecurity).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperSaves).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperAerialPlay).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperHandDistribution).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperKickDistribution).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperFirstTouch).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperPlayUnderPressure).IsRequired(false).HasColumnType("decimal(5,1)");

            // Goalkeeper Tactical sub-ratings
            builder.Property(r => r.KeeperPositioning).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperGameReading).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperOneOnOne).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperBackCoverage).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperSallyTiming).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperBuildupPlay).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperDefensiveOrganization).IsRequired(false).HasColumnType("decimal(5,1)");

            // Goalkeeper Competitiveness sub-ratings
            builder.Property(r => r.KeeperValor).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperConcentration).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperKeyMoments).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperErrorManagement).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperResponsibility).IsRequired(false).HasColumnType("decimal(5,1)");
            builder.Property(r => r.KeeperConsistency).IsRequired(false).HasColumnType("decimal(5,1)");

            builder.Property(r => r.RatedAt).IsRequired();
            builder.Property(r => r.Notes).IsRequired(false).HasMaxLength(500);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(r => r.TeamPlayerId);
            builder.HasIndex(r => r.RatedAt);
        }
    }
}
