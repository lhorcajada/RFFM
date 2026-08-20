using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
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

            builder.Property(tb => tb.Description)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseDescriptionMaxLength);

            builder.Property(tb => tb.FieldSpace)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseFieldSpaceMaxLength);

            builder.Property(tb => tb.UrlImage)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseUrlImageMaxLength);

            builder.Property(tb => tb.BoardStateJson)
                .IsRequired(false)
                .HasColumnType("text");

            builder.Property(tb => tb.Points).IsRequired();
            builder.Property(tb => tb.PlayersNumber).IsRequired();
            builder.Property(tb => tb.GoalPeekersNumber).IsRequired();

            builder.Property(tb => tb.ClubId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(tb => tb.Section)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(tb => tb.Methodology)
                .IsRequired()
                .HasMaxLength(50);

            builder.HasOne(tb => tb.Club)
                .WithMany()
                .HasForeignKey(tb => tb.ClubId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(tb => tb.Series).IsRequired();
            builder.Property(tb => tb.DurationSeries).IsRequired();
            builder.Property(tb => tb.RestSeries).IsRequired();
            builder.Property(tb => tb.Time).IsRequired();
            builder.Property(tb => tb.TouchesNumber).IsRequired();
            builder.Property(tb => tb.WildCards).IsRequired();

            builder.HasMany(tb => tb.Types)
                .WithOne(t => t.TaskTrainingBase)
                .HasForeignKey(t => t.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Property(tb => tb.MicrocicloId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.HasOne<Microciclo>()
                .WithMany()
                .HasForeignKey(tb => tb.MicrocicloId)
                .OnDelete(DeleteBehavior.SetNull);

            ConfigureHabilidadesColumn(builder.Property(tb => tb.Habilidades));
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