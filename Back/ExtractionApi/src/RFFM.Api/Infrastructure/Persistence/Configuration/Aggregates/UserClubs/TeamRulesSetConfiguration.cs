using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamRulesSetConfiguration : IEntityTypeConfiguration<TeamRulesSet>
    {
        public void Configure(EntityTypeBuilder<TeamRulesSet> builder)
        {
            builder.ToTable("TeamRulesSets");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.TeamId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasIndex(x => x.TeamId)
                .IsUnique();

            builder.Property(x => x.Title)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Subtitle)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.IntroNote)
                .IsRequired()
                .HasMaxLength(2000);

            builder.Property(x => x.ClosingNote)
                .HasMaxLength(2000);

            builder.Property(x => x.ApplicationNote)
                .HasMaxLength(2000);

            builder.Property(x => x.UpdatedAt)
                .IsRequired();

            builder.HasOne<Team>()
                .WithOne(t => t.RulesSet)
                .HasForeignKey<TeamRulesSet>(x => x.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(x => x.Rules)
                .WithOne(r => r.TeamRulesSet)
                .HasForeignKey(r => r.TeamRulesSetId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
