using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MacrocicloConfiguration : IEntityTypeConfiguration<Macrociclo>
    {
        public void Configure(EntityTypeBuilder<Macrociclo> builder)
        {
            builder.ToTable("Macrociclos");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SeasonPlanId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.StartDate).IsRequired();
            builder.Property(x => x.EndDate).IsRequired();

            builder.HasMany(x => x.Mesociclos)
                .WithOne()
                .HasForeignKey(m => m.MacrocicloId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
