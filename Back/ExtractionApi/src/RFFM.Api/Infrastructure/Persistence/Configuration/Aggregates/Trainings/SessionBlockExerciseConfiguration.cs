using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class SessionBlockExerciseConfiguration : IEntityTypeConfiguration<SessionBlockExercise>
    {
        public void Configure(EntityTypeBuilder<SessionBlockExercise> builder)
        {
            builder.ToTable("SessionBlockExercises");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.SessionBlockId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.TaskTrainingBaseId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.Position).IsRequired();

            // An exercise cannot be hard-deleted while still referenced by a session block —
            // it must be removed from the block first (see DeleteExercise's guard), or the
            // session/block deleted first. Restrict, not cascade: deleting a session/block must
            // never touch the TaskTrainingBase row itself (club-library lifetime is independent).
            builder.HasOne(x => x.Exercise)
                .WithMany()
                .HasForeignKey(x => x.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(x => x.SessionBlockId);
            builder.HasIndex(x => x.TaskTrainingBaseId);
        }
    }
}
