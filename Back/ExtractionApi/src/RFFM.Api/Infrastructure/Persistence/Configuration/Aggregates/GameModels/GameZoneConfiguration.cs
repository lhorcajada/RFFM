using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class GameZoneConfiguration : IEntityTypeConfiguration<GameZone>
    {
        public void Configure(EntityTypeBuilder<GameZone> builder)
        {
            builder.ToTable("GameZones");

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
                new { Id = 1, Name = "Zona de Iniciación",               Order = 1, IsActive = true },
                new { Id = 2, Name = "Zona de Creación en Campo Propio",  Order = 2, IsActive = true },
                new { Id = 3, Name = "Zona de Creación en Campo Rival",   Order = 3, IsActive = true },
                new { Id = 4, Name = "Zona de Finalización",              Order = 4, IsActive = true }
            );
        }
    }
}
