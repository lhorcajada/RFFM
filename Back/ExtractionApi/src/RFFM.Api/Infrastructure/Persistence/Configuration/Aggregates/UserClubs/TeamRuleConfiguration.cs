using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamRuleConfiguration : IEntityTypeConfiguration<TeamRule>
    {
        public void Configure(EntityTypeBuilder<TeamRule> builder)
        {
            builder.ToTable("TeamRules");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.TeamRulesSetId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.ShortTitle)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Highlight)
                .HasMaxLength(300);

            builder.Property(x => x.ViolationSummary)
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(x => x.ConsequenceSummary)
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(x => x.LongDescription)
                .HasMaxLength(4000);

            builder.Property(x => x.ConsequenceDetail)
                .HasMaxLength(1000);

            var bulletPointsProperty = builder.Property(x => x.BulletPoints)
                .HasConversion(
                    v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrEmpty(v) ? null : JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null))
                .HasColumnType("jsonb");

            bulletPointsProperty.Metadata.SetValueComparer(new ValueComparer<List<string>?>(
                (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
                v => v == null ? 0 : v.Aggregate(0, (hash, s) => HashCode.Combine(hash, s.GetHashCode())),
                v => v == null ? null : v.ToList()));

            builder.HasIndex(x => new { x.TeamRulesSetId, x.Order });
        }
    }
}
