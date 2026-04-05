using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GameModelConfiguration : IEntityTypeConfiguration<GameModel>
    {
        public void Configure(EntityTypeBuilder<GameModel> builder)
        {
            builder.ToTable("GameModels");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.TeamId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.Season)
                .IsRequired()
                .HasMaxLength(20);

            builder.HasIndex(x => new { x.TeamId, x.Season })
                .IsUnique();

            builder.HasMany(x => x.Scenarios)
                .WithOne(s => s.GameModel)
                .HasForeignKey(s => s.GameModelId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
