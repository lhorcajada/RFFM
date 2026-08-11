using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SubprincipioConfiguration : IEntityTypeConfiguration<Subprincipio>
    {
        public void Configure(EntityTypeBuilder<Subprincipio> builder)
        {
            builder.ToTable("Subprincipios");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GamePrincipleId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Numero)
                .IsRequired()
                .HasMaxLength(20);

            builder.Property(x => x.Titulo)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.HasIndex(x => new { x.GamePrincipleId, x.Key })
                .IsUnique();

            builder.HasMany(x => x.Zonas)
                .WithOne(z => z.Subprincipio)
                .HasForeignKey(z => z.SubprincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            // SubSubPrincipio → Subprincipio relationship is configured from the child side
            // (SubSubPrincipioConfiguration) because SubSubPrincipio has two mutually-exclusive
            // optional parents (SubprincipioId / ZonaId).
        }
    }
}
