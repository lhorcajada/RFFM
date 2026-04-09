using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamIdealLineupEntityConfiguration : IEntityTypeConfiguration<TeamIdealLineup>
    {
        public void Configure(EntityTypeBuilder<TeamIdealLineup> builder)
        {
            builder.ToTable("TeamIdealLineups");
            builder.HasKey(l => l.Id);
            builder.Property(l => l.TeamId).IsRequired();
            builder.Property(l => l.SeasonId).IsRequired();
            builder.Property(l => l.FormationId).IsRequired();

            builder.HasIndex(l => new { l.TeamId, l.SeasonId }).IsUnique();

            builder.HasMany(l => l.Slots)
                .WithOne(s => s.Lineup)
                .HasForeignKey(s => s.LineupId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(l => l.Formation)
                .WithMany()
                .HasForeignKey(l => l.FormationId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
