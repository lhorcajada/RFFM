using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamNoteEntityConfiguration : IEntityTypeConfiguration<TeamNote>
    {
        public void Configure(EntityTypeBuilder<TeamNote> builder)
        {
            builder.ToTable("TeamNotes");
            builder.HasKey(n => n.Id);

            builder.Property(n => n.TeamId).IsRequired();
            builder.Property(n => n.Text).IsRequired().HasMaxLength(500);
            builder.Property(n => n.Order).IsRequired();

            builder.HasIndex(n => new { n.TeamId, n.Order });

            builder.HasOne(n => n.Team)
                .WithMany()
                .HasForeignKey(n => n.TeamId);
        }
    }
}
