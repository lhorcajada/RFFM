using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class UserPersonalDataEntityConfiguration : IEntityTypeConfiguration<UserPersonalData>
    {
        public void Configure(EntityTypeBuilder<UserPersonalData> builder)
        {
            builder.ToTable("UserPersonalData");

            builder.HasKey(p => p.Id);

            builder.Property(p => p.ApplicationUserId).IsRequired();
            builder.Property(p => p.FirstName).HasMaxLength(UserPersonalData.Rules.NameMaxLength).IsRequired();
            builder.Property(p => p.LastName).HasMaxLength(UserPersonalData.Rules.NameMaxLength).IsRequired();
            builder.Property(p => p.SecondLastName).HasMaxLength(UserPersonalData.Rules.NameMaxLength).IsRequired(false);
            builder.Property(p => p.PhoneNumber).HasMaxLength(UserPersonalData.Rules.PhoneMaxLength).IsRequired(false);
            builder.Property(p => p.AvatarUrl).HasMaxLength(UserPersonalData.Rules.AvatarUrlMaxLength).IsRequired(false);
            builder.Property(p => p.CreatedAt).IsRequired();
            builder.Property(p => p.UpdatedAt).IsRequired();

            builder.HasIndex(p => p.ApplicationUserId).IsUnique();
        }
    }
}
