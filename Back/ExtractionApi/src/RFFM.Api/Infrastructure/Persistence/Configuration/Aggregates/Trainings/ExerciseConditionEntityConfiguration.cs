using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class ExerciseConditionEntityConfiguration : IEntityTypeConfiguration<ExerciseCondition>
    {
        public void Configure(EntityTypeBuilder<ExerciseCondition> builder)
        {
            builder.ToTable("ExerciseConditions");
            builder.HasKey(ec => ec.Id);

            builder.Property(ec => ec.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(ec => ec.TaskTrainingBaseId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(ec => ec.Text)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ExerciseConditionTextMaxLength);

            builder.Property(ec => ec.Order).IsRequired();

            builder.HasOne(ec => ec.TaskTrainingBase)
                .WithMany(tb => tb.Conditions)
                .HasForeignKey(ec => ec.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
