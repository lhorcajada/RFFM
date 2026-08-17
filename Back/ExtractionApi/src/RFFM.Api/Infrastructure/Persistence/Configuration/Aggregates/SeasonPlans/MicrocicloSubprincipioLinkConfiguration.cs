using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MicrocicloSubprincipioLinkConfiguration : IEntityTypeConfiguration<MicrocicloSubprincipioLink>
    {
        public void Configure(EntityTypeBuilder<MicrocicloSubprincipioLink> builder)
        {
            builder.ToTable("MicrocicloSubprincipioLinks");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.MicrocicloId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Session)
                .IsRequired()
                .HasMaxLength(1);

            builder.Property(x => x.SubprincipioId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasOne<Microciclo>()
                .WithMany(m => m.SubprincipioLinks)
                .HasForeignKey(x => x.MicrocicloId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cascade: if the referenced Subprincipio is removed from the team's GameModel,
            // the link row silently disappears — the Microciclo and its free text survive.
            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubprincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => new { x.MicrocicloId, x.Session, x.SubprincipioId })
                .IsUnique();
        }
    }
}
