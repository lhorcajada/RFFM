using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GameScenarioConfiguration : IEntityTypeConfiguration<GameScenario>
    {
        public void Configure(EntityTypeBuilder<GameScenario> builder)
        {
            builder.ToTable("GameScenarios");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Context)
                .HasMaxLength(2000);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.MediaUrl)
                .HasMaxLength(500);

            builder.Property(x => x.MediaType)
                .HasMaxLength(10);

            builder.HasOne(x => x.GameMoment)
                .WithMany(m => m.Scenarios)
                .HasForeignKey(x => x.GameMomentId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.GameZone)
                .WithMany(z => z.Scenarios)
                .HasForeignKey(x => x.GameZoneId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.TacticalPrinciples)
                .WithOne(tp => tp.GameScenario)
                .HasForeignKey(tp => tp.GameScenarioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.SubPrinciples)
                .WithOne(sp => sp.GameScenario)
                .HasForeignKey(sp => sp.GameScenarioId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
