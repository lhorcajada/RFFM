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

            builder.Property(tt => tt.Order)
                .IsRequired();

            builder.Property(tt => tt.SessionTrainingId)
                .IsRequired();

            builder.HasOne(tt => tt.TrainingSession)
                .WithMany(st => st.Tasks)
                .HasForeignKey(tt => tt.SessionTrainingId);

            builder.HasOne(tt => tt.Task)
                .WithMany()
                .HasForeignKey(tt => tt.Id); // Relación polimórfica con TaskTrainingBase.
        }
    }
}