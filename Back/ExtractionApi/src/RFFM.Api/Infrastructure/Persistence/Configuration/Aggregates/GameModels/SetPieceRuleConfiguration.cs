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

            // Unlike other GameModels Texto fields, a SetPieceRule's Texto can absorb an entire
            // ABP subsection's nested prose (e.g. "Faltas" spans several Subprincipios/Zonas)
            // rather than a single paragraph, so it is left unbounded (Postgres "text") instead
            // of the usual 4000-char cap.
            builder.Property(x => x.Texto);

            builder.HasIndex(x => new { x.GameModelId, x.Subtype })
                .IsUnique();
        }
    }
}
