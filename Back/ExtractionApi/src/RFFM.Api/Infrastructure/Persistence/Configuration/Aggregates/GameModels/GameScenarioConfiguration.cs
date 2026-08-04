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

            builder.Property(x => x.GamePrincipleId)
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

            builder.HasOne(x => x.GamePrinciple)
                .WithMany(p => p.Scenarios)
                .HasForeignKey(x => x.GamePrincipleId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.SubPrinciples)
                .WithOne(sp => sp.GameScenario)
                .HasForeignKey(sp => sp.GameScenarioId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
