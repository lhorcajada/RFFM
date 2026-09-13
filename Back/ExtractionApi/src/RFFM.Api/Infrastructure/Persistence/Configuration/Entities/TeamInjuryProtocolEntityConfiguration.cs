using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamInjuryProtocolEntityConfiguration : IEntityTypeConfiguration<TeamInjuryProtocol>
    {
        public void Configure(EntityTypeBuilder<TeamInjuryProtocol> builder)
        {
            builder.ToTable("TeamInjuryProtocols");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.TeamId).IsRequired();
            builder.Property(p => p.Content).IsRequired(false);
            builder.Property(p => p.UpdatedAt).IsRequired();
            builder.Property(p => p.UpdatedByUserId).HasMaxLength(450).IsRequired(false);

            builder.HasIndex(p => p.TeamId).IsUnique();

            builder.HasOne(p => p.Team)
                .WithOne(t => t.InjuryProtocol)
                .HasForeignKey<TeamInjuryProtocol>(p => p.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Metadata.FindNavigation(nameof(TeamInjuryProtocol.Attachments))!
                .SetPropertyAccessMode(PropertyAccessMode.Field);
        }
    }
}
