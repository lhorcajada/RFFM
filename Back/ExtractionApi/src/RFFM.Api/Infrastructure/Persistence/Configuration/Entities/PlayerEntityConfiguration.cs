using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Players;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayerEntityConfiguration : IEntityTypeConfiguration<Player>
    {
        public void Configure(EntityTypeBuilder<Player> builder)
        {
            builder.ToTable("Players");

            builder.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.PlayerNameMaxLength);

            builder.Property(p => p.LastName)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.PlayerLastNameMaxLength);
            builder.Property(p => p.BirthDate)
                .IsRequired(false);
            builder.Property(p => p.Alias)
                .IsRequired()
                .HasMaxLength(ValidationConstants.PlayerAliasMaxLength);
            builder.Property(p => p.UrlPhoto)
                .HasMaxLength(ValidationConstants.PlayerUrlPhotoMaxLength);
            builder.Property(p => p.Dni)
                .HasMaxLength(ValidationConstants.PlayerDniMaxLength);
                
            builder.HasKey(p => p.Id);
            builder.HasIndex(p => p.Id).IsUnique();
            builder.HasIndex(p => p.Alias).IsUnique();
            builder.HasOne(p => p.Club)
                .WithMany(c => c.Players)
                .HasForeignKey(p => p.ClubId)
                .OnDelete(DeleteBehavior.Restrict);

        }
    }
}
