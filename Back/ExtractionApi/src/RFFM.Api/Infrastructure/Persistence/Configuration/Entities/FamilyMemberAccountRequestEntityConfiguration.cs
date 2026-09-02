using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class FamilyMemberAccountRequestEntityConfiguration : IEntityTypeConfiguration<FamilyMemberAccountRequest>
    {
        public void Configure(EntityTypeBuilder<FamilyMemberAccountRequest> builder)
        {
            builder.ToTable("FamilyMemberAccountRequests");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(r => r.TeamPlayerFamilyMemberId).IsRequired();
            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.Status).IsRequired();
            builder.Property(r => r.RequestedAt).IsRequired();
            builder.Property(r => r.DecidedAt).IsRequired(false);
            builder.Property(r => r.DecidedByUserId)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.HasOne(r => r.TeamPlayerFamilyMember)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerFamilyMemberId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(r => r.TeamPlayerFamilyMemberId);
            builder.HasIndex(r => r.ApplicationUserId);
        }
    }
}
