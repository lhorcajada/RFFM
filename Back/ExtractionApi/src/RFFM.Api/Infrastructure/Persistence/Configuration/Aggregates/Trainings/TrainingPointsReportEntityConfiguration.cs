using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TrainingPointsReportEntityConfiguration : IEntityTypeConfiguration<TrainingPointsReport>
    {
        public void Configure(EntityTypeBuilder<TrainingPointsReport> builder)
        {
            builder.ToTable("TrainingPointsReports");
            builder.HasKey(tpr => tpr.Id);

            builder.Property(tpr => tpr.TotalPoints)
                .IsRequired();

            builder.Property(tpr => tpr.TrainingNumber)
                .IsRequired();

            builder.Property(tpr => tpr.AssistancePoint)
                .IsRequired();

            builder.Property(tpr => tpr.TecnicalPoints)
                .IsRequired();

            builder.Property(tpr => tpr.AttitudePoints)
                .IsRequired();

            builder.Property(tpr => tpr.TacticalPoints)
                .IsRequired();

            builder.Property(tpr => tpr.PhysicalPoints)
                .IsRequired();

            builder.Property(tpr => tpr.PlayerId)
                .IsRequired();

            builder.Property(tpr => tpr.SeasonId)
                .IsRequired();

            builder.HasOne(tpr => tpr.Player)
                .WithMany()
                .HasForeignKey(tpr => tpr.PlayerId);

            builder.HasOne(tpr => tpr.Season)
                .WithMany()
                .HasForeignKey(tpr => tpr.SeasonId);
        }
    }
}