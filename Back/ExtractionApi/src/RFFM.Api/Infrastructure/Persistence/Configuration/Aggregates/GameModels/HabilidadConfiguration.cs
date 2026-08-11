using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class HabilidadConfiguration : IEntityTypeConfiguration<Habilidad>
    {
        public void Configure(EntityTypeBuilder<Habilidad> builder)
        {
            builder.ToTable("Habilidades");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubSubPrincipioId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Nombre)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(x => x.Descripcion)
                .HasMaxLength(2000);

            builder.Property(x => x.Entrenable)
                .HasMaxLength(2000);

            builder.Property(x => x.ReferenciaAKey)
                .HasMaxLength(100);

            builder.HasIndex(x => new { x.SubSubPrincipioId, x.Nombre })
                .IsUnique();
        }
    }
}
