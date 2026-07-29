using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SubPrincipleConfiguration : IEntityTypeConfiguration<SubPrinciple>
    {
        public void Configure(EntityTypeBuilder<SubPrinciple> builder)
        {
            builder.ToTable("SubPrinciples");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameScenarioId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Label)
                .IsRequired()
                .HasMaxLength(10);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Context)
                .HasMaxLength(2000);

            builder.Property(x => x.Order)
                .IsRequired()
                .HasDefaultValue(0);

            builder.HasMany(x => x.SubSubPrinciples)
                .WithOne(ssp => ssp.SubPrinciple)
                .HasForeignKey(ssp => ssp.SubPrincipleId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
