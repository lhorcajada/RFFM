using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SubSubPrincipioConfiguration : IEntityTypeConfiguration<SubSubPrincipio>
    {
        public void Configure(EntityTypeBuilder<SubSubPrincipio> builder)
        {
            builder.ToTable("SubSubPrincipios");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubprincipioId)
                .HasMaxLength(36);

            builder.Property(x => x.ZonaId)
                .HasMaxLength(36);

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Numero)
                .IsRequired()
                .HasMaxLength(20);

            builder.Property(x => x.Rol)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.HasOne(x => x.Subprincipio)
                .WithMany(sp => sp.SubSubPrincipios)
                .HasForeignKey(x => x.SubprincipioId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Zona)
                .WithMany(z => z.SubSubPrincipios)
                .HasForeignKey(x => x.ZonaId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Habilidades)
                .WithOne(h => h.SubSubPrincipio)
                .HasForeignKey(h => h.SubSubPrincipioId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
