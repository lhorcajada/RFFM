using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    public class MatchParticipationEntityConfiguration : IEntityTypeConfiguration<MatchParticipation>
    {
        public void Configure(EntityTypeBuilder<MatchParticipation> builder)
        {
            builder.ToTable("MatchParticipations");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.EventId).IsRequired().HasMaxLength(200);
            builder.Property(x => x.TeamId).IsRequired().HasMaxLength(200);
            builder.Property(x => x.TeamPlayerId).IsRequired().HasMaxLength(200);
            builder.Property(x => x.MinutesPlayed).IsRequired();
            builder.Property(x => x.IsStarter).IsRequired();
            builder.Property(x => x.EnteredAtMinute);
            builder.Property(x => x.ExitedAtMinute);
            builder.Property(x => x.ScoreLocal).IsRequired();
            builder.Property(x => x.ScoreVisitor).IsRequired();
            builder.Property(x => x.MatchPhase).IsRequired().HasMaxLength(50);
            builder.Property(x => x.SubstitutionWindowsJson);
            builder.Property(x => x.RatingSnapshotsJson);
            builder.Property(x => x.GoalsJson);
            builder.Property(x => x.CardsJson);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.UpdatedAt).IsRequired();

            // Unique index: one participation record per player per event
            builder.HasIndex(x => new { x.EventId, x.TeamPlayerId }).IsUnique();

            // Index for season-minutes queries
            builder.HasIndex(x => new { x.TeamId, x.EventId });
        }
    }
}
