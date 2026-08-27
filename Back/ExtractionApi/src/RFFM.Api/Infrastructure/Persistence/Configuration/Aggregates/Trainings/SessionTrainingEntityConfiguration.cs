using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
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

            builder.Property(st => st.ObjetivoGeneral)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.SessionTrainingObjetivoGeneralMaxLength);

            builder.Property(st => st.MapaCampoTexto)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.SessionTrainingMapaCampoTextoMaxLength);

            builder.Property(st => st.MicrocicloId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.HasOne(st => st.Team)
                .WithMany(t => t.Trainings)
                .HasForeignKey(st => st.TeamId);

            builder.HasOne(st => st.SportEvent)
                .WithMany()
                .HasForeignKey(st => st.SportEventId)
                .IsRequired(false);

            // Optional, explicit association to a plan week. Same FK-on-the-child convention
            // used elsewhere (was TaskTrainingBase.MicrocicloId). SetNull: deleting a
            // SeasonPlan/Microciclo preserves the session, only clears its plan link.
            builder.HasOne<Microciclo>()
                .WithMany()
                .HasForeignKey(st => st.MicrocicloId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasMany(st => st.Blocks)
                .WithOne()
                .HasForeignKey(b => b.TrainingSessionId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
