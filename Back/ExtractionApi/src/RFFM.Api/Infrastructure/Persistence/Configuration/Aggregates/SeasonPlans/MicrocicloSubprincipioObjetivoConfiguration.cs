using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MicrocicloSubprincipioObjetivoConfiguration : IEntityTypeConfiguration<MicrocicloSubprincipioObjetivo>
    {
        public void Configure(EntityTypeBuilder<MicrocicloSubprincipioObjetivo> builder)
        {
            builder.ToTable("MicrocicloSubprincipiosObjetivo");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.MicrocicloId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.SubprincipioId).IsRequired().HasMaxLength(36);

            builder.HasOne<Microciclo>()
                .WithMany(m => m.SubprincipiosObjetivo)
                .HasForeignKey(x => x.MicrocicloId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cascade: if the referenced Subprincipio is removed from the team's GameModel, the
            // reference row silently disappears — the Microciclo and its other content survive.
            // Same choice already made for ExerciseModelRelation/the old MicrocicloSubprincipioLink.
            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubprincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.MicrocicloId);
        }
    }
}
