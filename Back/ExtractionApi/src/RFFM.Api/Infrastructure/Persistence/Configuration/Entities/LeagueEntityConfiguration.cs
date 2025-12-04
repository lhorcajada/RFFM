using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Competitions;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    public class LeagueEntityConfiguration : IEntityTypeConfiguration<League>
    {
        public void Configure(EntityTypeBuilder<League> builder)
        {
            builder.ToTable("Leagues");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.LeagueNameMaxLength);

            builder.Property(c => c.CategoryId)
                .IsRequired();


            builder.HasOne(c => c.Category)
                .WithMany()
                .HasForeignKey(c => c.CategoryId);

            builder.HasData(
                  new League(1, "COPA RFEF FASE AUTONÓMICA", 1),
                  new League(2, "FINAL COPA RFEF FASE AUTONÓMICA", 1),
                  new League(3, "PLAY OFF TERCERA FEDERACION", 1),
                  new League(4, "TERCERA FEDERACION RFEF", 1),
                  new League(5, "COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS", 2),
                  new League(6, "FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25", 2),
                  new League(7, "FINAL COPA PRIMERA DIVISION AUTONOMICA AFICIONADO RFFM", 2),
                  new League(8, "PRIMERA DIVISION AUTONOMICA AFICIONADO", 2),
                  new League(9, "PREFERENTE AFICIONADO", 2),
                  new League(10, "PRIMERA AFICIONADO", 2),
                  new League(11, "COPA DE AFICIONADOS RFFM TEMP 24/25", 2),
                  new League(12, "SEGUNDA AFICIONADO", 2),
                  new League(13, "NACIONAL JUVENIL", 3),
                  new League(14, "FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL", 3),
                  new League(15, "PRIMERA DIVISION AUTONOMICA JUVENIL", 3),
                  new League(16, "PREFERENTE JUVENIL", 3),
                  new League(17, "PRIMERA JUVENIL", 3),
                  new League(18, "SEGUNDA JUVENIL", 3),
                  new League(19, "SUPERLIGA CADETE", 4),
                  new League(20, "DIVISION DE HONOR CADETE", 4),
                  new League(21, "PRIMERA DIVISION AUTONOMICA CADETE", 4),
                  new League(22, "PREFERENTE CADETE", 4),
                  new League(23, "PRIMERA CADETE", 4),
                  new League(24, "SEGUNDA CADETE", 4),
                  new League(25, "SUPERLIGA INFANTIL", 5),
                  new League(26, "DIVISION DE HONOR INFANTIL", 5),
                  new League(27, "PRIMERA DIVISION AUTONOMICA INFANTIL", 5),
                  new League(28, "PREFERENTE INFANTIL", 5),
                  new League(29, "PRIMERA INFANTIL", 5),
                  new League(30, "SEGUNDA INFANTIL", 5),
                  new League(31, "SUPERLIGA ALEVIN", 6),
                  new League(32, "DIVISION DE HONOR ALEVIN", 6),
                  new League(33, "PRIMERA DIVISION AUTONOMICA ALEVIN", 6),
                  new League(34, "PREFERENTE ALEVIN", 6),
                  new League(35, "PRIMERA ALEVIN", 6),
                  new League(36, "VETERANOS MASCULINO F11", 7),
                  new League(37, "PRIMERA DIVISION AUTONÓMICA FEMENINO", 7),
                  new League(38, "PREFERENTE FUTBOL FEMENINO", 7),
                  new League(39, "PRIMERA FUTBOL FEMENINO", 7),
                  new League(40, "PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL", 7),
                  new League(41, "PREFERENTE FEMENINO JUVENIL", 7),
                  new League(42, "PRIMERA FEMENINO JUVENIL", 7),
                  new League(43, "PRIMERA DIVISION AUTONOMICA FEMENINO CADETE", 7),
                  new League(44, "PREFERENTE FEMENINO CADETE", 7),
                  new League(45, "PRIMERA FEMENINO CADETE", 7),
                  new League(46, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14", 8),
                  new League(47, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16", 8),
                  new League(48, "CAMPEONATO UNIVERSITARIO FEMENINO", 8),
                  new League(49, "CAMPEONATO UNIVERSITARIO MASCULINO", 8),
                  new League(50, "CAMPEONATO UNIVERSITARIO MASCULINO 2ª FASE F11", 8)
              );
        }
    }
}
