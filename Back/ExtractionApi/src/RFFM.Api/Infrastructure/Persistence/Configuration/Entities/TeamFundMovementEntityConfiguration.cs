using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamFundMovementEntityConfiguration : IEntityTypeConfiguration<TeamFundMovement>
    {
        public void Configure(EntityTypeBuilder<TeamFundMovement> builder)
        {
            builder.ToTable("TeamFundMovements");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.TeamId).IsRequired();
            builder.Property(m => m.Amount).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(m => m.Source).IsRequired();
            builder.Property(m => m.SourceSanctionId).HasMaxLength(450).IsRequired(false);
            builder.Property(m => m.OccurredAt).IsRequired();
            builder.Property(m => m.Description).HasMaxLength(1000).IsRequired(false);

            builder.HasIndex(m => m.TeamId);
            builder.HasIndex(m => m.SourceSanctionId)
                .IsUnique()
                .HasFilter("\"SourceSanctionId\" IS NOT NULL");

            builder.HasOne(m => m.Team)
                .WithMany(t => t.TeamFundMovements)
                .HasForeignKey(m => m.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
