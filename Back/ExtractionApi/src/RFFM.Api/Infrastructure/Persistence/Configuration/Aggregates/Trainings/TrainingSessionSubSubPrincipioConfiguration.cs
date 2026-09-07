using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TrainingSessionSubSubPrincipioConfiguration : IEntityTypeConfiguration<TrainingSessionSubSubPrincipio>
    {
        public void Configure(EntityTypeBuilder<TrainingSessionSubSubPrincipio> builder)
        {
            builder.ToTable("TrainingSessionSubSubPrincipios");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.TrainingSessionId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.SubSubPrincipioId).IsRequired().HasMaxLength(36);

            // Cascade: if the referenced SubSubPrincipio is removed from the team's GameModel,
            // the target row silently disappears — the session and its other content survive.
            // Same choice already made for ExerciseModelRelationItem.
            builder.HasOne<SubSubPrincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubSubPrincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.TrainingSessionId);
            builder.HasIndex(x => x.SubSubPrincipioId);
        }
    }
}
