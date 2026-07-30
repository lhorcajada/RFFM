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

            builder.HasIndex(s => s.TeamPlayerId);
            builder.HasIndex(s => new { s.TeamPlayerId, s.EndDate });

            builder.HasOne(s => s.TeamPlayer)
                .WithMany(tp => tp.Sanctions)
                .HasForeignKey(s => s.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
