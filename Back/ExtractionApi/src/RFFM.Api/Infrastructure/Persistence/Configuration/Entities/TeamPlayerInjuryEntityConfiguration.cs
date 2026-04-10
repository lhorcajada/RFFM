using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamPlayerInjuryEntityConfiguration : IEntityTypeConfiguration<TeamPlayerInjury>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerInjury> builder)
        {
            builder.ToTable("TeamPlayerInjuries");

            builder.HasKey(i => i.Id);

            builder.Property(i => i.TeamPlayerId).IsRequired();
            builder.Property(i => i.StartDate).IsRequired();
            builder.Property(i => i.InjuryType).HasMaxLength(200).IsRequired();
            builder.Property(i => i.Description).HasMaxLength(1000).IsRequired(false);
            builder.Property(i => i.EstimatedRecovery).HasMaxLength(200).IsRequired(false);
            builder.Property(i => i.EndDate).IsRequired(false);

            builder.HasIndex(i => i.TeamPlayerId);
            builder.HasIndex(i => new { i.TeamPlayerId, i.EndDate });

            builder.HasOne(i => i.TeamPlayer)
                .WithMany(tp => tp.Injuries)
                .HasForeignKey(i => i.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
