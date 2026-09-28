using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation.SquadHistory;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class SquadHistoryReportEntityConfiguration : IEntityTypeConfiguration<SquadHistoryReport>
    {
        public void Configure(EntityTypeBuilder<SquadHistoryReport> builder)
        {
            builder.ToTable("SquadHistoryReports");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).HasMaxLength(36);

            builder.Property(r => r.TeamCode).IsRequired().HasMaxLength(SquadHistoryReport.Rules.TeamCodeMaxLength);
            builder.Property(r => r.TeamName).IsRequired().HasMaxLength(SquadHistoryReport.Rules.TeamNameMaxLength);
            builder.Property(r => r.ErrorMessage).HasMaxLength(SquadHistoryReport.Rules.ErrorMessageMaxLength);
            builder.Property(r => r.CandidateSearchNote).HasMaxLength(SquadHistoryReport.Rules.CandidateSearchNoteMaxLength);
            builder.Property(r => r.Status)
                .IsRequired()
                .HasConversion(s => s.Value, v => SquadHistoryStatus.FromValue(v));

            builder.HasIndex(r => new { r.TeamCode, r.SeasonId }).IsUnique();
            builder.HasIndex(r => r.Status);

            builder.HasMany(r => r.Entries)
                .WithOne()
                .HasForeignKey(e => e.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(r => r.Entries).UsePropertyAccessMode(PropertyAccessMode.Field);

            builder.HasMany(r => r.Subscribers)
                .WithOne()
                .HasForeignKey(s => s.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(r => r.Subscribers).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class SquadHistoryEntryEntityConfiguration : IEntityTypeConfiguration<SquadHistoryEntry>
    {
        public void Configure(EntityTypeBuilder<SquadHistoryEntry> builder)
        {
            builder.ToTable("SquadHistoryEntries");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Id).HasMaxLength(36);
            builder.Property(e => e.ReportId).IsRequired().HasMaxLength(36);

            builder.Property(e => e.PlayerCode).IsRequired().HasMaxLength(50);
            builder.Property(e => e.PlayerName).IsRequired().HasMaxLength(256);
            builder.Property(e => e.SeasonName).IsRequired().HasMaxLength(50);
            builder.Property(e => e.CompetitionCode).IsRequired().HasMaxLength(50);
            builder.Property(e => e.CompetitionName).IsRequired().HasMaxLength(256);
            builder.Property(e => e.GroupCode).IsRequired().HasMaxLength(50);
            builder.Property(e => e.GroupName).IsRequired().HasMaxLength(256);
            builder.Property(e => e.TeamCode).IsRequired().HasMaxLength(50);
            builder.Property(e => e.TeamName).IsRequired().HasMaxLength(256);
            builder.Property(e => e.ClubName).IsRequired().HasMaxLength(256);
            builder.Property(e => e.TeamShieldUrl).HasMaxLength(1024);
            builder.Property(e => e.OriginTeamName).HasMaxLength(256);
            builder.Property(e => e.Source)
                .IsRequired()
                .HasConversion(s => s.Value, v => SquadHistorySource.FromValue(v));

            builder.HasIndex(e => e.ReportId);
        }
    }

    internal class SquadHistorySubscriberEntityConfiguration : IEntityTypeConfiguration<SquadHistorySubscriber>
    {
        public void Configure(EntityTypeBuilder<SquadHistorySubscriber> builder)
        {
            builder.ToTable("SquadHistorySubscribers");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(36);
            builder.Property(s => s.ReportId).IsRequired().HasMaxLength(36);
            builder.Property(s => s.UserId).IsRequired().HasMaxLength(450);

            builder.HasIndex(s => new { s.ReportId, s.UserId }).IsUnique();
        }
    }
}
