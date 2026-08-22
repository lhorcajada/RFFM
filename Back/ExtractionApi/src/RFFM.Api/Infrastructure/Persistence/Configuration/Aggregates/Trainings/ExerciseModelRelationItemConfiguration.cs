using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class ExerciseModelRelationItemConfiguration : IEntityTypeConfiguration<ExerciseModelRelationItem>
    {
        public void Configure(EntityTypeBuilder<ExerciseModelRelationItem> builder)
        {
            builder.ToTable("ExerciseModelRelationItems");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.ExerciseModelRelationId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.SubSubPrincipioId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.IsFoco).IsRequired();

            // Cascade: if the referenced SubSubPrincipio is removed from the team's GameModel,
            // the item row silently disappears — the parent relation survives.
            builder.HasOne<SubSubPrincipio>()
                .WithMany()
                .HasForeignKey(x => x.SubSubPrincipioId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.ExerciseModelRelationId);
        }
    }
}
