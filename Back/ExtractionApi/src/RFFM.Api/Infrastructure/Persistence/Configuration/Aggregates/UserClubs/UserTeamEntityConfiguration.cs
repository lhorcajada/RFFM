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

            builder.HasOne(ut => ut.Team)
                .WithMany()
                .HasForeignKey(ut => ut.TeamId);

            builder.HasOne(ut => ut.Membership)
                .WithMany()
                .HasForeignKey(ut => ut.RoleId);

            builder.HasIndex(ut => new { ut.ApplicationUserId, ut.TeamId });
            builder.HasIndex(ut => ut.ApplicationUserId);
        }
    }
}