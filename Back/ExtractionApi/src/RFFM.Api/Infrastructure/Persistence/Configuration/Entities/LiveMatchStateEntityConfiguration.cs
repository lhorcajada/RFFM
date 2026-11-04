using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.LiveMatches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    public sealed class LiveMatchStateEntityConfiguration : IEntityTypeConfiguration<LiveMatchState>
    {
        private static readonly JsonSerializerOptions DocumentsJsonOptions = new(JsonSerializerDefaults.Web);

        public void Configure(EntityTypeBuilder<LiveMatchState> builder)
        {
            builder.ToTable("LiveMatchStates");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.EventId).IsRequired().HasMaxLength(200);
            builder.Property(x => x.TeamId).IsRequired().HasMaxLength(200);
            builder.Property(x => x.Version).IsRequired().IsConcurrencyToken();
            builder.Property(x => x.Phase).IsRequired().HasMaxLength(50);
            builder.Property(x => x.ClockBaseSeconds).IsRequired();
            builder.Property(x => x.ClockReferenceUtc);
            builder.Property(x => x.MatchDurationMinutes).IsRequired();
            builder.Property(x => x.ScoreLocal).IsRequired();
            builder.Property(x => x.ScoreVisitor).IsRequired();
            builder.Property(x => x.Formation).HasMaxLength(50);
            builder.Property(x => x.ClosedAtUtc);
            builder.Property(x => x.Documents)
                .IsRequired()
                .HasColumnName("MatchDataJson")
                .HasColumnType("text")
                .HasConversion(
                    documents => JsonSerializer.Serialize(documents, DocumentsJsonOptions),
                    json => JsonSerializer.Deserialize<LiveMatchDocuments>(json, DocumentsJsonOptions)!);

            builder.Ignore(x => x.IsClosed);

            builder.HasIndex(x => x.EventId).IsUnique();
        }
    }
}
