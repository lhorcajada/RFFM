using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TechnicalTaskTrainingEntityConfiguration : IEntityTypeConfiguration<TechnicalTaskTraining>
    {
        public void Configure(EntityTypeBuilder<TechnicalTaskTraining> builder)
        {

            builder.Property(tt => tt.TouchesNumber)
                .IsRequired();

            builder.Property(tt => tt.WildCards)
                .IsRequired();
        }
    }

}