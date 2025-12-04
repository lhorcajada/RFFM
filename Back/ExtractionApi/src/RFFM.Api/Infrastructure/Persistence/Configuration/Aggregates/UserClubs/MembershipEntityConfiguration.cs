using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class MembershipEntityConfiguration : IEntityTypeConfiguration<Membership>
    {
        public void Configure(EntityTypeBuilder<Membership> builder)
        {
            builder.ToTable("Memberships");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.RoleNameMaxLength);

            builder.Property(r => r.Key)
                .IsRequired()
                .HasMaxLength(ValidationConstants.RoleKeyMaxLength);

            builder.HasMany(r => r.UserClubs)
                .WithOne(uc => uc.Membership)
                .HasForeignKey(uc => uc.RoleId);

            builder.HasData(Membership.GetAll());
        }
    }
}