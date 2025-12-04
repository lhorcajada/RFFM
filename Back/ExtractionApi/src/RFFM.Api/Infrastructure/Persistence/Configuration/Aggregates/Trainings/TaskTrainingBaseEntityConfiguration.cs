using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TaskTrainingBaseEntityConfiguration : IEntityTypeConfiguration<TaskTrainingBase>
    {
        public void Configure(EntityTypeBuilder<TaskTrainingBase> builder)
        {
            builder.HasKey(tb => tb.Id);

            builder.Property(tb => tb.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.TaskTrainingBaseNameMaxLength);

            builder.Property(tb => tb.Description)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseDescriptionMaxLength);

            builder.Property(tb => tb.FieldSpace)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseFieldSpaceMaxLength);

            builder.Property(tb => tb.UrlImage)
                .HasMaxLength(ValidationConstants.TaskTrainingBaseUrlImageMaxLength);

            builder.Property(tb => tb.Points)
                .IsRequired();
            builder.Property(tb => tb.PlayersNumber)
                .IsRequired();
            builder.Property(tb => tb.GoalPeekersNumber)
                .IsRequired();

            builder.HasDiscriminator<string>("Discriminator")
                .HasValue<TaskTrainingBase>("Base")
                .HasValue<PhysicalTaskTraining>("Physical")
                .HasValue<TechnicalTaskTraining>("Technical")
                .HasValue<TacticalTaskTraining>("Tactical");
        }
    }




}