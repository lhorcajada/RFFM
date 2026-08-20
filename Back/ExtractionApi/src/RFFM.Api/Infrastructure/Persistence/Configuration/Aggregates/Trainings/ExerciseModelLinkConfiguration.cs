using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class ExerciseModelLinkConfiguration : IEntityTypeConfiguration<ExerciseModelLink>
    {
        public void Configure(EntityTypeBuilder<ExerciseModelLink> builder)
        {
            builder.ToTable("ExerciseModelLinks");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.TaskTrainingBaseId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubprincipioId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.Property(x => x.SubSubPrincipioId)
                .IsRequired(false)
                .HasMaxLength(36);

            builder.Property(x => x.IsFoco)
                .IsRequired();

            builder.HasOne<TaskTrainingBase>()
                .WithMany(tb => tb.ModelLinks)
                .HasForeignKey(x => x.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cascade: if the referenced Subprincipio/SubSubPrincipio is removed from the team's
            // GameModel, the link row silently disappears — the exercise and its other content
            // survive. Same choice already made for MicrocicloSubprincipioLink/
            // MicrocicloSubSubPrincipioLink (Amendment 1).
            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubprincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<SubSubPrincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubSubPrincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.TaskTrainingBaseId);
        }
    }
}
