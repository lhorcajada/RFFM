using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class SessionTrainingEntityConfiguration : IEntityTypeConfiguration<TrainingSession>
    {
        public void Configure(EntityTypeBuilder<TrainingSession> builder)
        {
            builder.ToTable("SessionTrainings");
            builder.HasKey(st => st.Id);

            builder.Property(st => st.Name)
                .IsRequired()
                .HasMaxLength(ValidationConstants.SessionTrainingNameMaxLength);

            builder.Property(st => st.Description)
                .HasMaxLength(ValidationConstants.SessionTrainingDescriptionMaxLength);

            builder.Property(st => st.Date)
                .IsRequired();

            builder.Property(st => st.StartTime)
                .IsRequired();

            builder.Property(st => st.EndTime)
                .IsRequired(false);

            builder.Property(st => st.Location)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.SessionTrainingLocationMaxLength);

            builder.Property(st => st.UrlImage)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.SessionTrainingUrlImageMaxLength);

            builder.HasOne(st => st.Team)
                .WithMany(t => t.Trainings)
                .HasForeignKey(st => st.TeamId);

            builder.HasOne(st => st.SportEvent)
                .WithMany()
                .HasForeignKey(st => st.SportEventId);

            builder.HasMany(st => st.Tasks)
                .WithOne(tt => tt.TrainingSession)
                .HasForeignKey(tt => tt.SessionTrainingId);
        }
    }
}