using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class ZonaConfiguration : IEntityTypeConfiguration<Zona>
    {
        public void Configure(EntityTypeBuilder<Zona> builder)
        {
            builder.ToTable("Zonas");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubprincipioId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(150);

            builder.Property(x => x.ZoneKeysCsv)
                .IsRequired()
                .HasMaxLength(150);

            builder.Property(x => x.Label)
                .HasMaxLength(200);

            builder.Property(x => x.ZonaTexto)
                .HasMaxLength(500);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.HasIndex(x => new { x.SubprincipioId, x.Key })
                .IsUnique();

            // SubSubPrincipio → Zona relationship is configured from the child side
            // (SubSubPrincipioConfiguration) because SubSubPrincipio has two mutually-exclusive
            // optional parents (SubprincipioId / ZonaId).
        }
    }
}
