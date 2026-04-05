using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GameMomentConfiguration : IEntityTypeConfiguration<GameMoment>
    {
        public void Configure(EntityTypeBuilder<GameMoment> builder)
        {
            builder.ToTable("GameMoments");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.IsActive)
                .IsRequired()
                .HasDefaultValue(true);

            builder.HasData(
                new { Id = 1, Name = "Defensa Organizada",            Order = 1, IsActive = true },
                new { Id = 2, Name = "Ataque Organizado",             Order = 2, IsActive = true },
                new { Id = 3, Name = "Transición Defensa-Ataque",     Order = 3, IsActive = true },
                new { Id = 4, Name = "Transición Ataque-Defensa",     Order = 4, IsActive = true },
                new { Id = 5, Name = "Balón Parado",                  Order = 5, IsActive = true }
            );
        }
    }
}
