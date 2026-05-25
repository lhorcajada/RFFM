using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SeasonPrepTeamSessionEntityConfiguration : IEntityTypeConfiguration<SeasonPrepTeamSession>
    {
        public void Configure(EntityTypeBuilder<SeasonPrepTeamSession> builder)
        {
            builder.ToTable("SeasonPrepTeamSessions");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(50);
            builder.Property(s => s.TeamId).IsRequired().HasMaxLength(50);
            builder.Property(s => s.SportEventId).HasMaxLength(50);
            builder.Property(s => s.Data).IsRequired().HasColumnType("text");
            builder.Property(s => s.UpdatedAt).IsRequired();
            builder.HasIndex(s => new { s.TeamId, s.SportEventId }).IsUnique();
        }
    }
}
