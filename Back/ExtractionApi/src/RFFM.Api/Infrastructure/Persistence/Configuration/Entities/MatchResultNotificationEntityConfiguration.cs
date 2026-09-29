using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class MatchResultNotificationOptOutEntityConfiguration : IEntityTypeConfiguration<MatchResultNotificationOptOut>
    {
        public void Configure(EntityTypeBuilder<MatchResultNotificationOptOut> builder)
        {
            builder.ToTable("MatchResultNotificationOptOuts");
            builder.HasKey(o => o.Id);
            builder.Property(o => o.Id).HasMaxLength(36);
            builder.Property(o => o.UserId).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.UserIdMaxLength);
            builder.HasIndex(o => o.UserId).IsUnique();
        }
    }

    internal class MatchResultNotificationLogEntityConfiguration : IEntityTypeConfiguration<MatchResultNotificationLog>
    {
        public void Configure(EntityTypeBuilder<MatchResultNotificationLog> builder)
        {
            builder.ToTable("MatchResultNotificationLogs");
            builder.HasKey(l => l.Id);
            builder.Property(l => l.Id).HasMaxLength(36);
            builder.Property(l => l.UserId).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.UserIdMaxLength);
            builder.Property(l => l.RecordCode).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.RecordCodeMaxLength);
            builder.Property(l => l.TeamCode).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.TeamCodeMaxLength);
            builder.Property(l => l.LocalGoals).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.GoalsMaxLength);
            builder.Property(l => l.VisitorGoals).IsRequired().HasMaxLength(MatchResultNotificationLog.Rules.GoalsMaxLength);
            builder.HasIndex(l => new { l.UserId, l.RecordCode }).IsUnique();
        }
    }
}
