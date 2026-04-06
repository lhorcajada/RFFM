using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TaskTrainingEntityConfiguration : IEntityTypeConfiguration<TaskTraining>
    {
        public void Configure(EntityTypeBuilder<TaskTraining> builder)
        {
            builder.ToTable("TaskTrainings");
            builder.HasKey(tt => tt.Id);

            builder.Property(tt => tt.Order).IsRequired();

            builder.Property(tt => tt.Section)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(tt => tt.SessionTrainingId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(tt => tt.TaskTrainingBaseId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasOne(tt => tt.TrainingSession)
                .WithMany(st => st.Tasks)
                .HasForeignKey(tt => tt.SessionTrainingId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(tt => tt.Task)
                .WithMany()
                .HasForeignKey(tt => tt.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}