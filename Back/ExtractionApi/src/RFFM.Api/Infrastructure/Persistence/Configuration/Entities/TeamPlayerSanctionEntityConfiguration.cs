using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamPlayerSanctionEntityConfiguration : IEntityTypeConfiguration<TeamPlayerSanction>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerSanction> builder)
        {
            builder.ToTable("TeamPlayerSanctions");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.TeamPlayerId).IsRequired();
            builder.Property(s => s.Category).IsRequired();
            builder.Property(s => s.StartDate).IsRequired();
            builder.Property(s => s.SanctionType).HasMaxLength(200).IsRequired();
            builder.Property(s => s.Description).HasMaxLength(1000).IsRequired(false);
            builder.Property(s => s.EstimatedEnd).HasMaxLength(200).IsRequired(false);
            builder.Property(s => s.EndDate).IsRequired(false);
            builder.Property(s => s.IsAutomatic).IsRequired().HasDefaultValue(false);
            builder.Property(s => s.Fine).HasColumnType("decimal(10,2)").IsRequired(false);
            builder.Property(s => s.SourceEventId).HasMaxLength(450).IsRequired(false);
            builder.Property(s => s.SportivePunishmentType).IsRequired(false);
            builder.Property(s => s.TargetEventId).HasMaxLength(450).IsRequired(false);
            builder.Property(s => s.MinutesLimit).IsRequired(false);
            builder.Property(s => s.AmountPaid).HasColumnType("decimal(10,2)").IsRequired(false);

            builder.HasIndex(s => s.TeamPlayerId);
            builder.HasIndex(s => new { s.TeamPlayerId, s.EndDate });
            builder.HasIndex(s => new { s.TeamPlayerId, s.IsAutomatic, s.EndDate });
            builder.HasIndex(s => s.TargetEventId);

            builder.HasOne(s => s.TeamPlayer)
                .WithMany(tp => tp.Sanctions)
                .HasForeignKey(s => s.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(s => s.TargetEvent)
                .WithMany()
                .HasForeignKey(s => s.TargetEventId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        }
    }
}
