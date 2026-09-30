using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayerModelObservationEntityConfiguration : IEntityTypeConfiguration<PlayerModelObservation>
    {
        public void Configure(EntityTypeBuilder<PlayerModelObservation> builder)
        {
            builder.ToTable("PlayerModelObservations");

            builder.HasKey(o => o.Id);

            builder.Property(o => o.TeamPlayerId).IsRequired();
            builder.Property(o => o.TeamId).IsRequired();
            builder.Property(o => o.Date).IsRequired();
            builder.Property(o => o.Kind).IsRequired();
            builder.Property(o => o.MomentName).HasMaxLength(PlayerModelObservation.Rules.LabelMaxLength).IsRequired(false);
            builder.Property(o => o.PrincipleLabel).HasMaxLength(PlayerModelObservation.Rules.LabelMaxLength).IsRequired(false);
            builder.Property(o => o.SubprincipioLabel).HasMaxLength(PlayerModelObservation.Rules.LabelMaxLength).IsRequired(false);
            builder.Property(o => o.AttitudeKey).HasMaxLength(50).IsRequired(false);
            JsonColumns.ConfigureStringList(builder.Property(o => o.Habilidades));
            builder.Property(o => o.Assessment).IsRequired();
            builder.Property(o => o.Comment).HasMaxLength(PlayerModelObservation.Rules.CommentMaxLength).IsRequired(false);
            builder.Property(o => o.CreatedByUserId).IsRequired();
            builder.Property(o => o.CreatedAt).IsRequired();

            builder.HasIndex(o => new { o.TeamPlayerId, o.Date });
            builder.HasIndex(o => new { o.TeamId, o.Date });

            builder.HasOne<TeamPlayer>()
                .WithMany()
                .HasForeignKey(o => o.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(o => o.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            // SetNull: la observación es un registro para hablar con la familia y no puede perderse
            // al reestructurar el modelo de juego; las etiquetas guardadas la mantienen legible.
            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(o => o.SubprincipioId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne<TrainingSession>()
                .WithMany()
                .HasForeignKey(o => o.TrainingSessionId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
