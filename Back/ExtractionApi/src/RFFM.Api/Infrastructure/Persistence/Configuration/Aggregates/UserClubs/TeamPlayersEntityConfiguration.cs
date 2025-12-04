using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PlayerFeet;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerEntityConfiguration : IEntityTypeConfiguration<TeamPlayer>
    {
        public void Configure(EntityTypeBuilder<TeamPlayer> builder)
        {
            // Tabla principal
            builder.ToTable("TeamPlayers");
            builder.HasKey(tp => tp.Id);

            // Propiedades básicas
            builder.Property(tp => tp.TeamId)
                .IsRequired();

            builder.Property(tp => tp.PlayerId)
                .IsRequired();

            builder.Property(tp => tp.JoinedDate)
                .IsRequired();

            builder.Property(tp => tp.LeftDate)
                .IsRequired(false);

            // Relación con Team
            builder.HasOne(tp => tp.Team)
                .WithMany(t => t.Players)
                .HasForeignKey(tp => tp.TeamId);

            // Relación con Player
            builder.HasOne(tp => tp.Player)
                .WithMany()
                .HasForeignKey(tp => tp.PlayerId);

            // Configuración de Value Objects


            builder.OwnsOne(tp => tp.Demarcation, demarcation =>
            {
                demarcation.ToTable("TeamPlayerDemarcations");

                // Configuración de ActivePositionId
                demarcation.Property(d => d.ActivePositionId)
                    .IsRequired();

                // Configuración de PossibleDemarcationIds como una lista de enteros
                demarcation.Property(d => d.PossibleDemarcationIds)
                    .HasConversion(
                        v => string.Join(',', v), // Convertir lista de IDs a string
                        v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList()) // Convertir string a lista de IDs
                    .IsRequired(false);
            });

            // Configuración de PlayerContactInfo
            builder.OwnsOne(tp => tp.ContactInfo, contactInfo =>
            {
                contactInfo.ToTable("TeamPlayerContactInfos");
                contactInfo.Property(ci => ci.Phone)
                    .HasMaxLength(15)
                    .IsRequired(false);

                contactInfo.Property(ci => ci.Email)
                    .HasMaxLength(255)
                    .IsRequired(false);

                // Configuración de Address dentro de PlayerContactInfo
                contactInfo.OwnsOne(ci => ci.Address, address =>
                {
                    address.Property(a => a.Street)
                        .HasMaxLength(200)
                        .IsRequired(false);

                    address.Property(a => a.City)
                        .HasMaxLength(100)
                        .IsRequired(false);

                    address.Property(a => a.Province)
                        .HasMaxLength(100)
                        .IsRequired(false);

                    address.Property(a => a.PostalCode)
                        .HasMaxLength(20)
                        .IsRequired(false);

                    address.Property(a => a.Country)
                        .HasMaxLength(100)
                        .IsRequired(false);
                });
            });

            // Configuración de Dorsal
            builder.OwnsOne(tp => tp.Dorsal, dorsal =>
            {
                dorsal.ToTable("TeamPlayerDorsals");
                dorsal.Property(d => d.Number)
                    .IsRequired(); // El número siempre debe estar presente
            });

            // Configuración de PhysicalAttributes
            builder.OwnsOne(tp => tp.PhysicalInfo, physicalInfo =>
            {
                physicalInfo.ToTable("TeamPlayerPhysicalAttributes");
                physicalInfo.Property(pi => pi.Height)
                    .HasColumnType("decimal(5, 2)") // Altura con precisión decimal
                    .IsRequired(false);

                physicalInfo.Property(pi => pi.Weight)
                    .HasColumnType("decimal(5, 2)") // Peso con precisión decimal
                    .IsRequired(false);

                physicalInfo.Property(pi => pi.DominantFoot)
                    .HasConversion(
                        v => v!.Id, // Conversión de DominantFoot a su Id
                        v => PlayerFeet.GetById(v)) // Conversión de Id a DominantFoot
                    .IsRequired(false);
            });

            // Configuración de Family
            builder.OwnsOne(tp => tp.Family, family =>
            {
                family.ToTable("TeamPlayerFamilies");
                family.Property(f => f.Phone)
                    .HasMaxLength(15)
                    .IsRequired(false);

                family.Property(f => f.Email)
                    .HasMaxLength(255)
                    .IsRequired(false);

                family.Property(f => f.Name)
                    .HasMaxLength(100)
                    .IsRequired(false);

                family.Property(f => f.FamilyMember)
                    .HasMaxLength(50)
                    .IsRequired(false);

                // Configuración de Address dentro de Family
                family.OwnsOne(f => f.Address, address =>
                {
                    address.Property(a => a.Street)
                        .HasMaxLength(200)
                        .IsRequired(false);

                    address.Property(a => a.City)
                        .HasMaxLength(100)
                        .IsRequired(false);

                    address.Property(a => a.Province)
                        .HasMaxLength(100)
                        .IsRequired(false);

                    address.Property(a => a.PostalCode)
                        .HasMaxLength(20)
                        .IsRequired(false);

                    address.Property(a => a.Country)
                        .HasMaxLength(100)
                        .IsRequired(false);
                });
            });
        }
    }
}
