using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class ExerciseTypeConfiguration : IEntityTypeConfiguration<ExerciseType>
    {
        public void Configure(EntityTypeBuilder<ExerciseType> builder)
        {
            builder.ToTable("ExerciseTypes");
            builder.HasKey(t => t.Id);
            builder.Property(t => t.Name).IsRequired().HasMaxLength(50);
            builder.HasIndex(t => t.Name).IsUnique();
        }
    }
}
