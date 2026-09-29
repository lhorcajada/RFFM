using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation.Results;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class RffmCompetitionGroupEntityConfiguration : IEntityTypeConfiguration<RffmCompetitionGroup>
    {
        public void Configure(EntityTypeBuilder<RffmCompetitionGroup> builder)
        {
            builder.ToTable("RffmCompetitionGroups");
            builder.HasKey(g => g.Id);
            builder.Property(g => g.Id).HasMaxLength(36);

            builder.Property(g => g.GroupCode).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.CodeMaxLength);
            builder.Property(g => g.CompetitionCode).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.CodeMaxLength);
            builder.Property(g => g.CompetitionName).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.NameMaxLength);
            builder.Property(g => g.GroupName).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.NameMaxLength);
            builder.Property(g => g.StandingsJson).HasColumnType("jsonb");
            builder.Property(g => g.OfficialStandingsJson).HasColumnType("jsonb");
            builder.Ignore(g => g.Points);

            builder.HasIndex(g => g.GroupCode).IsUnique();
        }
    }

    internal class RffmStandingsSnapshotEntityConfiguration : IEntityTypeConfiguration<RffmStandingsSnapshot>
    {
        public void Configure(EntityTypeBuilder<RffmStandingsSnapshot> builder)
        {
            builder.ToTable("RffmStandingsSnapshots");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(36);
            builder.Property(s => s.GroupCode).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.CodeMaxLength);
            builder.Property(s => s.PayloadJson).IsRequired().HasColumnType("jsonb");
            builder.Property(s => s.Source)
                .IsRequired()
                .HasConversion(s => s.Value, v => StandingsSource.FromValue(v));

            builder.HasIndex(s => new { s.GroupCode, s.Round }).IsUnique();
        }
    }

    internal class RffmRoundEntityConfiguration : IEntityTypeConfiguration<RffmRound>
    {
        public void Configure(EntityTypeBuilder<RffmRound> builder)
        {
            builder.ToTable("RffmRounds");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).HasMaxLength(36);

            builder.Property(r => r.GroupCode).IsRequired().HasMaxLength(RffmRound.Rules.GroupCodeMaxLength);
            builder.Property(r => r.Name).IsRequired().HasMaxLength(RffmRound.Rules.NameMaxLength);

            builder.HasIndex(r => new { r.GroupCode, r.Number }).IsUnique();

            builder.HasMany(r => r.Matches)
                .WithOne()
                .HasForeignKey(m => m.RffmRoundId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(r => r.Matches).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class RffmMatchEntityConfiguration : IEntityTypeConfiguration<RffmMatch>
    {
        public void Configure(EntityTypeBuilder<RffmMatch> builder)
        {
            builder.ToTable("RffmMatches");
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Id).HasMaxLength(36);
            builder.Property(m => m.RffmRoundId).IsRequired().HasMaxLength(36);
            builder.Property(m => m.RecordCode).IsRequired().HasMaxLength(50);
            builder.Property(m => m.LocalTeamCode).HasMaxLength(50);
            builder.Property(m => m.VisitorTeamCode).HasMaxLength(50);
            builder.Ignore(m => m.IsFinal);
            builder.Ignore(m => m.HasSchedule);

            builder.HasIndex(m => new { m.RffmRoundId, m.RecordCode }).IsUnique();
            builder.HasIndex(m => m.RecordCode);
            builder.HasIndex(m => m.RecordClosed);
        }
    }

    internal class RffmMatchRecordEntityConfiguration : IEntityTypeConfiguration<RffmMatchRecord>
    {
        public void Configure(EntityTypeBuilder<RffmMatchRecord> builder)
        {
            builder.ToTable("RffmMatchRecords");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).HasMaxLength(36);
            builder.Property(r => r.RecordCode).IsRequired().HasMaxLength(50);
            builder.Property(r => r.GroupCode).IsRequired().HasMaxLength(RffmCompetitionGroup.Rules.CodeMaxLength);
            builder.Property(r => r.PayloadJson).IsRequired().HasColumnType("jsonb");

            builder.HasIndex(r => r.RecordCode).IsUnique();
        }
    }
}
