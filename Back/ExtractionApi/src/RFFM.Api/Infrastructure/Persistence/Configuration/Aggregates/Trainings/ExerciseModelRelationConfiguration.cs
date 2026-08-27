using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class ExerciseModelRelationConfiguration : IEntityTypeConfiguration<ExerciseModelRelation>
    {
        public void Configure(EntityTypeBuilder<ExerciseModelRelation> builder)
        {
            builder.ToTable("ExerciseModelRelations");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.TaskTrainingBaseId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.SubprincipioId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.IsFoco).IsRequired();

            JsonColumns.ConfigureStringList(builder.Property(x => x.HabilidadesImprescindibles));

            builder.HasMany(x => x.Items)
                .WithOne()
                .HasForeignKey(i => i.ExerciseModelRelationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Cascade: if the referenced Subprincipio is removed from the team's GameModel, the
            // relation row silently disappears — the exercise and its other content survive.
            // Same choice already made for the old ExerciseModelLink/MicrocicloSubprincipioLink.
            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubprincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.TaskTrainingBaseId);
        }
    }
}
