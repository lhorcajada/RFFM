using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class LeagueSquadStatsReportEntityConfiguration : IEntityTypeConfiguration<LeagueSquadStatsReport>
    {
        public void Configure(EntityTypeBuilder<LeagueSquadStatsReport> builder)
        {
            builder.ToTable("LeagueSquadStatsReports");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).HasMaxLength(36);

            builder.Property(r => r.CompetitionCode).IsRequired().HasMaxLength(LeagueSquadStatsReport.Rules.CodeMaxLength);
            builder.Property(r => r.GroupCode).IsRequired().HasMaxLength(LeagueSquadStatsReport.Rules.CodeMaxLength);
            builder.Property(r => r.ErrorMessage).HasMaxLength(LeagueSquadStatsReport.Rules.ErrorMessageMaxLength);
            builder.Property(r => r.Status)
                .IsRequired()
                .HasConversion(s => s.Value, v => LeagueSquadStatsStatus.FromValue(v));
            builder.Ignore(r => r.IsInProgress);

            builder.HasIndex(r => new { r.SeasonId, r.CompetitionCode, r.GroupCode }).IsUnique();
            builder.HasIndex(r => r.Status);

            builder.HasMany(r => r.Teams)
                .WithOne()
                .HasForeignKey(t => t.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(r => r.Teams).UsePropertyAccessMode(PropertyAccessMode.Field);

            builder.HasMany(r => r.Subscribers)
                .WithOne()
                .HasForeignKey(s => s.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(r => r.Subscribers).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class LeagueSquadTeamEntityConfiguration : IEntityTypeConfiguration<LeagueSquadTeam>
    {
        public void Configure(EntityTypeBuilder<LeagueSquadTeam> builder)
        {
            builder.ToTable("LeagueSquadTeams");
            builder.HasKey(t => t.Id);
            builder.Property(t => t.Id).HasMaxLength(36);
            builder.Property(t => t.ReportId).IsRequired().HasMaxLength(36);

            builder.Property(t => t.TeamCode).IsRequired().HasMaxLength(LeagueSquadTeam.Rules.TeamCodeMaxLength);
            builder.Property(t => t.TeamName).IsRequired().HasMaxLength(LeagueSquadTeam.Rules.TeamNameMaxLength);
            builder.Property(t => t.ShieldUrl).HasMaxLength(LeagueSquadTeam.Rules.ShieldUrlMaxLength);

            builder.HasIndex(t => new { t.ReportId, t.TeamCode }).IsUnique();

            builder.HasMany(t => t.Players)
                .WithOne()
                .HasForeignKey(p => p.LeagueSquadTeamId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Navigation(t => t.Players).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class LeagueSquadPlayerEntityConfiguration : IEntityTypeConfiguration<LeagueSquadPlayer>
    {
        public void Configure(EntityTypeBuilder<LeagueSquadPlayer> builder)
        {
            builder.ToTable("LeagueSquadPlayers");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).HasMaxLength(36);
            builder.Property(p => p.LeagueSquadTeamId).IsRequired().HasMaxLength(36);

            builder.Property(p => p.PlayerCode).IsRequired().HasMaxLength(LeagueSquadPlayer.Rules.PlayerCodeMaxLength);
            builder.Property(p => p.PlayerName).IsRequired().HasMaxLength(LeagueSquadPlayer.Rules.PlayerNameMaxLength);

            builder.HasIndex(p => p.PlayerCode);
        }
    }

    internal class LeagueSquadStatsSubscriberEntityConfiguration : IEntityTypeConfiguration<LeagueSquadStatsSubscriber>
    {
        public void Configure(EntityTypeBuilder<LeagueSquadStatsSubscriber> builder)
        {
            builder.ToTable("LeagueSquadStatsSubscribers");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(36);
            builder.Property(s => s.ReportId).IsRequired().HasMaxLength(36);
            builder.Property(s => s.UserId).IsRequired().HasMaxLength(450);
            builder.Property(s => s.TeamId).IsRequired().HasMaxLength(36);

            builder.HasIndex(s => new { s.ReportId, s.UserId }).IsUnique();
        }
    }

    internal class RffmPlayerSeasonStatsEntityConfiguration : IEntityTypeConfiguration<RffmPlayerSeasonStats>
    {
        public void Configure(EntityTypeBuilder<RffmPlayerSeasonStats> builder)
        {
            builder.ToTable("RffmPlayerSeasonStats");
            builder.HasKey(s => s.Id);
            builder.Property(s => s.Id).HasMaxLength(36);

            builder.Property(s => s.PlayerCode).IsRequired().HasMaxLength(RffmPlayerSeasonStats.Rules.PlayerCodeMaxLength);
            builder.Property(s => s.PlayerName).IsRequired().HasMaxLength(RffmPlayerSeasonStats.Rules.PlayerNameMaxLength);
            builder.Property(s => s.Position).HasMaxLength(RffmPlayerSeasonStats.Rules.PositionMaxLength);
            builder.Property(s => s.ParticipationsJson).IsRequired();

            builder.HasIndex(s => new { s.PlayerCode, s.SeasonId }).IsUnique();
            builder.HasIndex(s => s.SeasonId);
        }
    }
}
