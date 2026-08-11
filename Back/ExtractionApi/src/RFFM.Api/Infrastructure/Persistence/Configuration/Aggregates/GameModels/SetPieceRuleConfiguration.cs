using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SetPieceRuleConfiguration : IEntityTypeConfiguration<SetPieceRule>
    {
        public void Configure(EntityTypeBuilder<SetPieceRule> builder)
        {
            builder.ToTable("SetPieceRules");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Subtype)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.HasIndex(x => new { x.GameModelId, x.Subtype })
                .IsUnique();
        }
    }
}
