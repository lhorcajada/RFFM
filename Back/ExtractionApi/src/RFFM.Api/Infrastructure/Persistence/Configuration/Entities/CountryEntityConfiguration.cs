using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class CountryEntityConfiguration : IEntityTypeConfiguration<Country>
    {
        public void Configure(EntityTypeBuilder<Country> builder)
        {
            builder.ToTable("Countries");

            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(c => c.Code)
                .IsRequired();

            builder.HasKey(c => c.Id);

            var countries = LoadCountriesFromJson();

            builder.HasData(countries);

        }
        private List<Country> LoadCountriesFromJson()
        {
            var filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"Infrastructure", "MasterData", "Countries.json");

            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"El archivo {filePath} no fue encontrado.");
            }

            var jsonData = File.ReadAllText(filePath);
            var countries = JsonSerializer.Deserialize<List<Country>>(jsonData);

            if (countries == null)
            {
                throw new InvalidOperationException("No se pudieron cargar los países desde el JSON.");
            }

            return countries;
        }
    }
}
