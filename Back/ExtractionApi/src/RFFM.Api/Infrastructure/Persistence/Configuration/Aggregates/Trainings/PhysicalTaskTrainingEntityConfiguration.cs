using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class PhysicalTaskTrainingEntityConfiguration : IEntityTypeConfiguration<PhysicalTaskTraining>
    {
        public void Configure(EntityTypeBuilder<PhysicalTaskTraining> builder)
        {

            builder.Property(pt => pt.Series)
                .IsRequired();

            builder.Property(pt => pt.DurationSeries)
                .IsRequired();

            builder.Property(pt => pt.RestSeries)
                .IsRequired();

            builder.Property(pt => pt.Time)
                .IsRequired();
        }
    }


}