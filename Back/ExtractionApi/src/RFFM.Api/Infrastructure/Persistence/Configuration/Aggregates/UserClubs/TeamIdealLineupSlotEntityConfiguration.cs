using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamIdealLineupSlotEntityConfiguration : IEntityTypeConfiguration<TeamIdealLineupSlot>
    {
        public void Configure(EntityTypeBuilder<TeamIdealLineupSlot> builder)
        {
            builder.ToTable("TeamIdealLineupSlots");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.LineupId).IsRequired();
            builder.Property(s => s.SlotIndex).IsRequired();
            builder.Property(s => s.TeamPlayerId).IsRequired(false);

            builder.HasIndex(s => new { s.LineupId, s.SlotIndex }).IsUnique();
            builder.HasIndex(s => s.TeamPlayerId);
        }
    }
}
