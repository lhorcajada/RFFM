using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TacticalTaskTrainingEntityConfiguration : IEntityTypeConfiguration<TacticalTaskTraining>
    {
        public void Configure(EntityTypeBuilder<TacticalTaskTraining> builder)
        {

            builder.Property(tt => tt.TouchesNumber)
                .IsRequired();

            builder.Property(tt => tt.WildCards)
                .IsRequired();
        }
    }

}