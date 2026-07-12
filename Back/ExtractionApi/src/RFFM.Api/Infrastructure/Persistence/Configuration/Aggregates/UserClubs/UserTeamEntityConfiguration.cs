using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class UserTeamEntityConfiguration : IEntityTypeConfiguration<UserTeam>
    {
        public void Configure(EntityTypeBuilder<UserTeam> builder)
        {
            builder.ToTable("UserTeams");
            builder.HasKey(ut => ut.Id);

            builder.Property(ut => ut.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(ut => ut.TeamId)
                .IsRequired();

            builder.Property(ut => ut.RoleId)
                .IsRequired();

            builder.Property(ut => ut.IsCreator)
                .IsRequired();

            builder.Property(ut => ut.JoinedAt)
                .IsRequired();

            builder.Property(ut => ut.LinkedTeamPlayerId)
                .IsRequired(false);

            builder.HasOne(ut => ut.Team)
                .WithMany()
                .HasForeignKey(ut => ut.TeamId);

            builder.HasOne(ut => ut.Membership)
                .WithMany()
                .HasForeignKey(ut => ut.RoleId);

            builder.HasOne(ut => ut.TeamPlayer)
                .WithMany()
                .HasForeignKey(ut => ut.LinkedTeamPlayerId)
                .OnDelete(DeleteBehavior.Restrict);

            // Only one Membership.Player-kind account may claim a given TeamPlayer;
            // FamilyPlayer rows are excluded from this constraint (design.md §4) —
            // replace 4 below with the REAL Membership.Player.Id constant value if it
            // differs (Membership.Player.Id == 4 per Domain/Aggregates/UserClubs/Membership.cs
            // at the time this script was written — double check before generating SQL).
            builder.HasIndex(ut => ut.LinkedTeamPlayerId)
                .IsUnique()
                .HasFilter("\"LinkedTeamPlayerId\" IS NOT NULL AND \"RoleId\" = 4");

            builder.HasIndex(ut => new { ut.ApplicationUserId, ut.TeamId });
            builder.HasIndex(ut => ut.ApplicationUserId);
        }
    }
}