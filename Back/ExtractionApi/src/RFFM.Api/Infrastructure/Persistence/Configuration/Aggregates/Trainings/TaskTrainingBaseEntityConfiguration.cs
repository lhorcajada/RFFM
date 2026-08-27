using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TaskTrainingBaseEntityConfiguration : IEntityTypeConfiguration<TaskTrainingBase>
    {
        public void Configure(EntityTypeBuilder<TaskTrainingBase> builder)
        {
            builder.ToTable("TaskTrainingBases");
            builder.HasKey(tb => tb.Id);

            builder.Property(tb => tb.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.TaskTrainingBaseNameMaxLength);

            builder.Property(tb => tb.Tipo)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(tb => tb.Objetivo)
                .IsRequired()
                .HasMaxLength(2000);

            builder.Property(tb => tb.ObjetivoPorRol)
                .IsRequired(false)
                .HasMaxLength(2000);

            builder.Property(tb => tb.Logistica)
                .IsRequired()
                .HasMaxLength(2000);

            builder.Property(tb => tb.DurationMinutes)
                .IsRequired(false);

            builder.Property(tb => tb.Porteros)
                .IsRequired(false)
                .HasMaxLength(1000);

            builder.Property(tb => tb.Dibujo)
                .IsRequired(false)
                .HasMaxLength(1000);

            builder.Property(tb => tb.Descripcion)
                .IsRequired()
                .HasColumnType("text");

            builder.Property(tb => tb.UrlImage)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseUrlImageMaxLength);

            builder.Property(tb => tb.BoardStateJson)
                .IsRequired(false)
                .HasColumnType("text");

            builder.Property(tb => tb.ClubId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasOne(tb => tb.Club)
                .WithMany()
                .HasForeignKey(tb => tb.ClubId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(tb => tb.ModelRelations)
                .WithOne()
                .HasForeignKey(r => r.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            JsonColumns.ConfigureStringList(builder.Property(tb => tb.NivelesColumnas));
            ConfigureNivelesColumn(builder.Property(tb => tb.Niveles));
        }

        private static void ConfigureNivelesColumn(PropertyBuilder<List<ExerciseLevelRow>> property)
        {
            property
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrEmpty(v)
                        ? new List<ExerciseLevelRow>()
                        : JsonSerializer.Deserialize<List<ExerciseLevelRow>>(v, (JsonSerializerOptions?)null)!)
                .HasColumnType("jsonb");

            property.Metadata.SetValueComparer(new ValueComparer<List<ExerciseLevelRow>>(
                (a, b) => (a ?? new List<ExerciseLevelRow>()).SequenceEqual(b ?? new List<ExerciseLevelRow>()),
                v => v.Aggregate(0, (hash, row) => HashCode.Combine(hash, row.GetHashCode())),
                v => v.ToList()));
        }
    }

    /// <summary>Shared jsonb <c>List&lt;string&gt;</c> column helper — same conversion pattern
    /// used across the codebase for closed-vocabulary/free-text lists (Habilidades, palanca
    /// column names, etc.). Centralized here so every consumer configures it identically.</summary>
    internal static class JsonColumns
    {
        public static void ConfigureStringList(PropertyBuilder<List<string>> property)
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
