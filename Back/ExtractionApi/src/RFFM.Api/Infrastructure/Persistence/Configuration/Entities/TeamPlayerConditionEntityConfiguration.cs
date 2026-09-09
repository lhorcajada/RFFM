using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamPlayerConditionEntityConfiguration : IEntityTypeConfiguration<TeamPlayerCondition>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerCondition> builder)
        {
            builder.ToTable("TeamPlayerConditions");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.TeamPlayerId).IsRequired();
            builder.Property(c => c.PhysicalFitness).IsRequired();
            builder.Property(c => c.Fatigue).IsRequired();
            builder.Property(c => c.LastCalculatedDate).IsRequired();

            builder.HasIndex(c => c.TeamPlayerId).IsUnique();

            builder.HasOne(c => c.TeamPlayer)
                .WithMany()
                .HasForeignKey(c => c.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
