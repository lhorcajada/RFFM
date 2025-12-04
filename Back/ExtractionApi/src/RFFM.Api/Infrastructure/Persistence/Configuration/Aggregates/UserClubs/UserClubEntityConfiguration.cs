using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class UserClubEntityConfiguration : IEntityTypeConfiguration<UserClub>
    {
        public void Configure(EntityTypeBuilder<UserClub> builder)
        {
            builder.ToTable("UserClubs");
            builder.HasKey(uc => uc.Id);

            builder.Property(uc => uc.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(uc => uc.ClubId)
                .IsRequired();

            builder.Property(uc => uc.RoleId)
                .IsRequired();

            builder.Property(uc => uc.IsCreator)
                .IsRequired();

            builder.HasOne(uc => uc.Club)
                .WithMany(c => c.UserClubs)
                .HasForeignKey(uc => uc.ClubId);

            builder.HasOne(uc => uc.Membership)
                .WithMany(r => r.UserClubs)
                .HasForeignKey(uc => uc.RoleId);
        }
    }
}