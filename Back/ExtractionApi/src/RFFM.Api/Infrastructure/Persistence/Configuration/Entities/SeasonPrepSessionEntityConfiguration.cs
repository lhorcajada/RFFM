using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SeasonPrepSessionEntityConfiguration : IEntityTypeConfiguration<SeasonPrepSession>
    {
        public void Configure(EntityTypeBuilder<SeasonPrepSession> builder)
        {
            builder.ToTable("SeasonPrepSessions");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(50);
            builder.Property(s => s.UserId).IsRequired().HasMaxLength(50);
            builder.Property(s => s.SportEventId).HasMaxLength(50);
            builder.Property(s => s.Data).IsRequired().HasColumnType("text");
            builder.Property(s => s.UpdatedAt).IsRequired();
            builder.HasIndex(s => new { s.UserId, s.SportEventId }).IsUnique();
        }
    }
}
