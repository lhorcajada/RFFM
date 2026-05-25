using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SeasonPrepAllTeamsSessionEntityConfiguration : IEntityTypeConfiguration<SeasonPrepAllTeamsSession>
    {
        public void Configure(EntityTypeBuilder<SeasonPrepAllTeamsSession> builder)
        {
            builder.ToTable("SeasonPrepAllTeamsSessions");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(50);
            builder.Property(s => s.SportEventId).HasMaxLength(50);
            builder.Property(s => s.Data).IsRequired().HasColumnType("text");
            builder.Property(s => s.UpdatedAt).IsRequired();
            builder.HasIndex(s => s.SportEventId).IsUnique();
        }
    }
}
