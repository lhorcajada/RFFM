using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class SubSubPrincipleConfiguration : IEntityTypeConfiguration<SubSubPrinciple>
    {
        public void Configure(EntityTypeBuilder<SubSubPrinciple> builder)
        {
            builder.ToTable("SubSubPrinciples");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubPrincipleId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Action)
                .HasMaxLength(2000);

            builder.Property(x => x.Order)
                .IsRequired()
                .HasDefaultValue(0);

            builder.HasMany(x => x.EssentialSkills)
                .WithOne(es => es.SubSubPrinciple)
                .HasForeignKey(es => es.SubSubPrincipleId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
