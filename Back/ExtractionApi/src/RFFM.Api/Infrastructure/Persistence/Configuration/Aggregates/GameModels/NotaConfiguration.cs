using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class NotaConfiguration : IEntityTypeConfiguration<Nota>
    {
        public void Configure(EntityTypeBuilder<Nota> builder)
        {
            builder.ToTable("Notas");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Tipo)
                .IsRequired()
                .HasMaxLength(30);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.Property(x => x.PrincipioId).HasMaxLength(36);
            builder.Property(x => x.SubprincipioId).HasMaxLength(36);
            builder.Property(x => x.ZonaId).HasMaxLength(36);
            builder.Property(x => x.SubSubPrincipioId).HasMaxLength(36);

            // Anchors reference other GameModel-family aggregates but are not modeled as EF
            // navigation FKs (no single parent type) — deletion of an anchor node is handled at
            // the application layer (UpdateGameModel/importer remove the orphaned Nota).
            builder.HasIndex(x => x.PrincipioId);
            builder.HasIndex(x => x.SubprincipioId);
            builder.HasIndex(x => x.ZonaId);
            builder.HasIndex(x => x.SubSubPrincipioId);
        }
    }
}
