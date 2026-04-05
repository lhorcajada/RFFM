using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SubPrincipleTacticalPrincipleConfiguration : IEntityTypeConfiguration<SubPrincipleTacticalPrinciple>
    {
        public void Configure(EntityTypeBuilder<SubPrincipleTacticalPrinciple> builder)
        {
            builder.ToTable("SubPrincipleTacticalPrinciples");

            builder.HasKey(x => new { x.SubPrincipleId, x.TechnicalGoalId });

            builder.Property(x => x.SubPrincipleId)
                .IsRequired()
                .HasMaxLength(36);
        }
    }
}
