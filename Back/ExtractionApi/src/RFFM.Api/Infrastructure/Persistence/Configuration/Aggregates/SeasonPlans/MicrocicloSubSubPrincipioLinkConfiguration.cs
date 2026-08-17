using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MicrocicloSubSubPrincipioLinkConfiguration : IEntityTypeConfiguration<MicrocicloSubSubPrincipioLink>
    {
        public void Configure(EntityTypeBuilder<MicrocicloSubSubPrincipioLink> builder)
        {
            builder.ToTable("MicrocicloSubSubPrincipioLinks");

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

            builder.Property(x => x.SubSubPrincipioId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasOne<Microciclo>()
                .WithMany(m => m.SubSubPrincipioLinks)
                .HasForeignKey(x => x.MicrocicloId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cascade: if the referenced SubSubPrincipio is removed from the team's GameModel,
            // the link row silently disappears — the Microciclo and its free text survive.
            builder.HasOne<SubSubPrincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubSubPrincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => new { x.MicrocicloId, x.Session, x.SubSubPrincipioId })
                .IsUnique();
        }
    }
}
