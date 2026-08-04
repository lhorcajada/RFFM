using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GamePrincipleConfiguration : IEntityTypeConfiguration<GamePrinciple>
    {
        public void Configure(EntityTypeBuilder<GamePrinciple> builder)
        {
            builder.ToTable("GamePrinciples");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Title)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Description)
                .HasMaxLength(2000);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.HasOne(x => x.GameMoment)
                .WithMany(m => m.Principles)
                .HasForeignKey(x => x.GameMomentId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.GameZone)
                .WithMany(z => z.Principles)
                .HasForeignKey(x => x.GameZoneId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.Scenarios)
                .WithOne(s => s.GamePrinciple)
                .HasForeignKey(s => s.GamePrincipleId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
