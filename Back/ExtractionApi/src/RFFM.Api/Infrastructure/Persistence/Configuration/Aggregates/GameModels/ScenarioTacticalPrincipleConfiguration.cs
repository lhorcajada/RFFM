using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class ScenarioTacticalPrincipleConfiguration : IEntityTypeConfiguration<ScenarioTacticalPrinciple>
    {
        public void Configure(EntityTypeBuilder<ScenarioTacticalPrinciple> builder)
        {
            builder.ToTable("ScenarioTacticalPrinciples");

            builder.HasKey(x => new { x.GameScenarioId, x.TechnicalGoalId });

            builder.Property(x => x.GameScenarioId)
                .IsRequired()
                .HasMaxLength(36);
        }
    }
}
