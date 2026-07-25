using Microsoft.EntityFrameworkCore;
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

            builder.Property(tb => tb.SubSubPrincipleId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.Property(tb => tb.SubPrincipleId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.Property(tb => tb.Section)
                .IsRequired()
                .HasMaxLength(50);

            builder.HasOne(tb => tb.Club)
                .WithMany()
                .HasForeignKey(tb => tb.ClubId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(tb => tb.SubSubPrinciple)
                .WithMany()
                .HasForeignKey(tb => tb.SubSubPrincipleId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(tb => tb.SubPrinciple)
                .WithMany()
                .HasForeignKey(tb => tb.SubPrincipleId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Property(tb => tb.Series).IsRequired();
            builder.Property(tb => tb.DurationSeries).IsRequired();
            builder.Property(tb => tb.RestSeries).IsRequired();
            builder.Property(tb => tb.Time).IsRequired();
            builder.Property(tb => tb.TouchesNumber).IsRequired();
            builder.Property(tb => tb.WildCards).IsRequired();

            builder.HasMany(tb => tb.Skills)
                .WithOne(s => s.TaskTrainingBase)
                .HasForeignKey(s => s.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(tb => tb.Types)
                .WithOne(t => t.TaskTrainingBase)
                .HasForeignKey(t => t.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}