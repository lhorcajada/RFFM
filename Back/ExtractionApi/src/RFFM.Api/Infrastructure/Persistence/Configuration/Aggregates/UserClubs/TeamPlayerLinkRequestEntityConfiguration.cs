using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerLinkRequestEntityConfiguration : IEntityTypeConfiguration<TeamPlayerLinkRequest>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerLinkRequest> builder)
        {
            builder.ToTable("TeamPlayerLinkRequests");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(r => r.TeamId).IsRequired();
            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.MembershipId).IsRequired();
            builder.Property(r => r.Status).IsRequired();
            builder.Property(r => r.RequestedAt).IsRequired();
            builder.Property(r => r.DecidedAt).IsRequired(false);
            builder.Property(r => r.DecidedByUserId)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.HasOne(r => r.Team)
                .WithMany()
                .HasForeignKey(r => r.TeamId);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId);

            builder.HasOne(r => r.Membership)
                .WithMany()
                .HasForeignKey(r => r.MembershipId);

            builder.HasIndex(r => new { r.TeamId, r.Status });
            builder.HasIndex(r => r.TeamPlayerId);
            builder.HasIndex(r => r.ApplicationUserId);
        }
    }
}
