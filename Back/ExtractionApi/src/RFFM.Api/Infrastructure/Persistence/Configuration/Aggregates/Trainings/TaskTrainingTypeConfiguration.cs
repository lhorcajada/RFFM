using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TaskTrainingTypeConfiguration : IEntityTypeConfiguration<TaskTrainingType>
    {
        public void Configure(EntityTypeBuilder<TaskTrainingType> builder)
        {
            builder.ToTable("TaskTrainingTypes");
            builder.HasKey(t => new { t.TaskTrainingBaseId, t.ExerciseTypeId });
            builder.Property(t => t.TaskTrainingBaseId).IsRequired().HasMaxLength(36);
            builder.Property(t => t.ExerciseTypeId).IsRequired().HasMaxLength(36);

            builder.HasOne(t => t.TaskTrainingBase)
                .WithMany(tb => tb.Types)
                .HasForeignKey(t => t.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(t => t.ExerciseType)
                .WithMany()
                .HasForeignKey(t => t.ExerciseTypeId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
