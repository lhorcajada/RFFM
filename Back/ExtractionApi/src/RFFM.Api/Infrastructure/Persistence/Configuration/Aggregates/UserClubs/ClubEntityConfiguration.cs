using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class ClubEntityConfiguration : IEntityTypeConfiguration<Club>
    {
        public void Configure(EntityTypeBuilder<Club> builder)
        {
            builder.ToTable("Clubs");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ClubNameMaxLength);

            builder.Property(c => c.CountryId)
                .IsRequired();

            builder.Property(c => c.ShieldUrl)
                .HasMaxLength(ValidationConstants.ClubShieldUrlMaxLength);

            builder.Property(c => c.InvitationCode)
                .HasMaxLength(8); // Asumiendo que el código de invitación es de longitud fija.

            builder.HasOne(c => c.Country)
                .WithMany()
                .HasForeignKey(c => c.CountryId);

            builder.HasMany(c => c.UserClubs)
                .WithOne(uc => uc.Club)
                .HasForeignKey(uc => uc.ClubId);

            builder.HasMany(c => c.Teams)
                .WithOne(t => t.Club)
                .HasForeignKey(t => t.ClubId);
        }
    }
}