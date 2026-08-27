using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class SessionBlockConfiguration : IEntityTypeConfiguration<SessionBlock>
    {
        public void Configure(EntityTypeBuilder<SessionBlock> builder)
        {
            builder.ToTable("SessionBlocks");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id).IsRequired().HasMaxLength(36);
            builder.Property(x => x.TrainingSessionId).IsRequired().HasMaxLength(36);
            builder.Property(x => x.Order).IsRequired();
            builder.Property(x => x.Nombre).IsRequired().HasMaxLength(200);
            builder.Property(x => x.ComoConectaConAnterior).IsRequired().HasMaxLength(2000);
            builder.Property(x => x.RotacionEntreEjercicios).IsRequired(false).HasMaxLength(2000);

            builder.HasMany(x => x.Exercises)
                .WithOne()
                .HasForeignKey(e => e.SessionBlockId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.TrainingSessionId);
        }
    }
}
