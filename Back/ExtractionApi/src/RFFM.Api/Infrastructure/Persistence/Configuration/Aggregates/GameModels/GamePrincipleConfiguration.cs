using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GamePrincipleConfiguration : IEntityTypeConfiguration<GamePrinciple>
    {
        public void Configure(EntityTypeBuilder<GamePrinciple> builder)
        {
            builder.ToTable("GamePrinciples");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Key)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Numero)
                .IsRequired();

            builder.Property(x => x.Titulo)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Texto)
                .HasMaxLength(4000);

            builder.HasIndex(x => new { x.GameModelId, x.Key })
                .IsUnique();

            builder.HasOne(x => x.GameMoment)
                .WithMany(m => m.Principles)
                .HasForeignKey(x => x.GameMomentId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.Subprincipios)
                .WithOne(sp => sp.GamePrinciple)
                .HasForeignKey(sp => sp.GamePrincipleId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
