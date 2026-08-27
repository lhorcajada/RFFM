using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MesocicloConfiguration : IEntityTypeConfiguration<Mesociclo>
    {
        public void Configure(EntityTypeBuilder<Mesociclo> builder)
        {
            builder.ToTable("Mesociclos");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.MacrocicloId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.StartDate).IsRequired();
            builder.Property(x => x.EndDate).IsRequired();

            builder.Property(x => x.GameZoneId).IsRequired();

            builder.HasOne<GameZone>()
                .WithMany()
                .HasForeignKey(x => x.GameZoneId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.Microciclos)
                .WithOne()
                .HasForeignKey(m => m.MesocicloId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
