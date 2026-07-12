using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class ClubJoinRequestEntityConfiguration : IEntityTypeConfiguration<ClubJoinRequest>
    {
        public void Configure(EntityTypeBuilder<ClubJoinRequest> builder)
        {
            builder.ToTable("ClubJoinRequests");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(r => r.ClubId).IsRequired();
            builder.Property(r => r.MembershipId).IsRequired();
            builder.Property(r => r.Status).IsRequired();
            builder.Property(r => r.RequestedAt).IsRequired();
            builder.Property(r => r.DecidedAt).IsRequired(false);
            builder.Property(r => r.DecidedByUserId)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.HasOne(r => r.Club)
                .WithMany()
                .HasForeignKey(r => r.ClubId);

            builder.HasOne(r => r.Membership)
                .WithMany()
                .HasForeignKey(r => r.MembershipId);

            builder.HasIndex(r => new { r.ClubId, r.Status });
            builder.HasIndex(r => r.ApplicationUserId);
        }
    }
}
