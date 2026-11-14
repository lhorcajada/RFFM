using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamTraitDefinitionEntityConfiguration : IEntityTypeConfiguration<TeamTraitDefinition>
    {
        public void Configure(EntityTypeBuilder<TeamTraitDefinition> builder)
        {
            builder.ToTable("TeamTraitDefinitions");
            builder.HasKey(t => t.Id);

            builder.Property(t => t.TeamId).IsRequired();
            builder.Property(t => t.Key).IsRequired().HasMaxLength(RatingConfigRules.MaxKeyLength);
            builder.Property(t => t.IsCustom).IsRequired();
            builder.Property(t => t.IsHidden).IsRequired();
            builder.Property(t => t.Label).HasMaxLength(RatingConfigRules.MaxLabelLength);
            builder.Property(t => t.Phase).HasMaxLength(20);
            builder.Property(t => t.Anchor1).HasMaxLength(RatingConfigRules.MaxTextLength);
            builder.Property(t => t.Anchor3).HasMaxLength(RatingConfigRules.MaxTextLength);
            builder.Property(t => t.Anchor5).HasMaxLength(RatingConfigRules.MaxTextLength);

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(t => t.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(t => new { t.TeamId, t.Key }).IsUnique();
        }
    }

    internal class TeamCapacityDefinitionEntityConfiguration : IEntityTypeConfiguration<TeamCapacityDefinition>
    {
        public void Configure(EntityTypeBuilder<TeamCapacityDefinition> builder)
        {
            builder.ToTable("TeamCapacityDefinitions");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.TeamId).IsRequired();
            builder.Property(c => c.Key).IsRequired().HasMaxLength(RatingConfigRules.MaxKeyLength);
            builder.Property(c => c.IsCustom).IsRequired();
            builder.Property(c => c.IsHidden).IsRequired();
            builder.Property(c => c.Sheet).IsRequired().HasMaxLength(15);
            builder.Property(c => c.CategoryKey).IsRequired().HasMaxLength(20);
            builder.Property(c => c.Label).HasMaxLength(RatingConfigRules.MaxLabelLength);

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(c => c.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(c => new { c.TeamId, c.Key }).IsUnique();
        }
    }
}
