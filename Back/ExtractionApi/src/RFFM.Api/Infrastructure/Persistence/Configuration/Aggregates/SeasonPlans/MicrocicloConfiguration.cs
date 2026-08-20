using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonPlans
{
    internal class MicrocicloConfiguration : IEntityTypeConfiguration<Microciclo>
    {
        public void Configure(EntityTypeBuilder<Microciclo> builder)
        {
            builder.ToTable("Microciclos");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.MesocicloId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Order)
                .IsRequired();

            builder.Property(x => x.WeekLabel)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(x => x.StartDate).IsRequired();
            builder.Property(x => x.EndDate).IsRequired();

            builder.Property(x => x.ObjetivoSesionA)
                .IsRequired()
                .HasMaxLength(2000);

            builder.Property(x => x.ObjetivoSesionB)
                .IsRequired()
                .HasMaxLength(2000);

            // Per-session field zone (see Microciclo's doc-comment): unlike Mesociclo.GameZoneId
            // (one zone for the whole Mesociclo), Sesión A and Sesión B of the same week
            // frequently train in different zones in the real "Plan de Temporada", so each is
            // its own required int column. No FK to the GameZone catalog table here (unlike
            // Mesociclo.GameZoneId's HasOne<GameZone>() below) because other Microciclo writers —
            // CreateSeasonPlan/UpdateSeasonPlan command handlers and their tests — do not yet
            // populate these fields and would fail an FK check with the CLR default (0); adding
            // the FK is follow-up work once those handlers are updated to collect per-session
            // zones too.
            builder.Property(x => x.GameZoneIdSesionA)
                .IsRequired();

            builder.Property(x => x.GameZoneIdSesionB)
                .IsRequired();

            ConfigureHabilidadesColumn(builder.Property(x => x.SesionAHabilidades));
            ConfigureHabilidadesColumn(builder.Property(x => x.SesionBHabilidades));
        }

        private static void ConfigureHabilidadesColumn(PropertyBuilder<List<string>> property)
        {
            property
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrEmpty(v)
                        ? new List<string>()
                        : JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!)
                .HasColumnType("jsonb");

            property.Metadata.SetValueComparer(new ValueComparer<List<string>>(
                (a, b) => (a ?? new List<string>()).SequenceEqual(b ?? new List<string>()),
                v => v.Aggregate(0, (hash, s) => HashCode.Combine(hash, s.GetHashCode())),
                v => v.ToList()));
        }
    }
}
