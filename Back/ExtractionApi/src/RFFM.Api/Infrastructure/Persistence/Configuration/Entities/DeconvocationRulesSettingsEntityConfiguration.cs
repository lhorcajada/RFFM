using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class DeconvocationRulesSettingsEntityConfiguration : IEntityTypeConfiguration<DeconvocationRulesSettings>
    {
        public void Configure(EntityTypeBuilder<DeconvocationRulesSettings> builder)
        {
            builder.ToTable("DeconvocationRulesSettings");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.TeamId).IsRequired();
            builder.Property(s => s.RulesJson).HasColumnType("jsonb").IsRequired();
            builder.Property(s => s.UpdatedOn).IsRequired();

            builder.HasIndex(s => s.TeamId).IsUnique();

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(s => s.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
