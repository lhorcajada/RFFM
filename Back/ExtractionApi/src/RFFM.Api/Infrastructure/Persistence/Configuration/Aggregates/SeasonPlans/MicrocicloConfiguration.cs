using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MicrocicloConfiguration : IEntityTypeConfiguration<Microciclo>
    {
        public void Configure(EntityTypeBuilder<Microciclo> builder)
        {
            builder.ToTable("Microciclos");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.MesocicloId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.WeekLabel)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.StartDate).IsRequired();
            builder.Property(x => x.EndDate).IsRequired();
        }
    }
}
