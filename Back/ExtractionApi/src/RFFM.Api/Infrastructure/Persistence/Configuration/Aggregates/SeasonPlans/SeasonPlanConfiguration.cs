using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class SeasonPlanConfiguration : IEntityTypeConfiguration<SeasonPlan>
    {
        public void Configure(EntityTypeBuilder<SeasonPlan> builder)
        {
            builder.ToTable("SeasonPlans");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.TeamId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SeasonId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasIndex(x => new { x.TeamId, x.SeasonId })
                .IsUnique();

            builder.HasOne<Domain.Entities.Seasons.Season>()
                .WithMany()
                .HasForeignKey(x => x.SeasonId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.Macrociclos)
                .WithOne()
                .HasForeignKey(m => m.SeasonPlanId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
