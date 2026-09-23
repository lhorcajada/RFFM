using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Audit;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class UserActivityLogEntityConfiguration : IEntityTypeConfiguration<UserActivityLog>
    {
        public void Configure(EntityTypeBuilder<UserActivityLog> builder)
        {
            builder.ToTable("UserActivityLogs");
            builder.HasKey(a => a.Id);

            builder.Property(a => a.UserId).IsRequired();
            builder.Property(a => a.RoleName).HasMaxLength(50).IsRequired();
            builder.Property(a => a.ClubId).IsRequired(false);
            builder.Property(a => a.TeamId).IsRequired(false);
            builder.Property(a => a.Timestamp).IsRequired();
            builder.Property(a => a.IpAddress).HasMaxLength(45).IsRequired(false); // IPv6 max length
            builder.Property(a => a.EventType).HasMaxLength(50).IsRequired();
            builder.Property(a => a.ActionOrPage).HasMaxLength(150).IsRequired();
            builder.Property(a => a.Result).HasMaxLength(20).IsRequired();
            builder.Property(a => a.Reason).HasMaxLength(500).IsRequired(false);
            builder.Property(a => a.SubjectId).IsRequired(false);

            // No FK navigation properties by design (design.md Decision 8) — soft references only.
            builder.HasIndex(a => new { a.ClubId, a.Timestamp });
            builder.HasIndex(a => new { a.TeamId, a.Timestamp });
            builder.HasIndex(a => a.UserId);
        }
    }
}
