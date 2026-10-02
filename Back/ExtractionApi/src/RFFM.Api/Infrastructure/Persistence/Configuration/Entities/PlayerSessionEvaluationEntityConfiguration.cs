using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayerSessionEvaluationEntityConfiguration : IEntityTypeConfiguration<PlayerSessionEvaluation>
    {
        public void Configure(EntityTypeBuilder<PlayerSessionEvaluation> builder)
        {
            builder.ToTable("PlayerSessionEvaluations");

            builder.HasKey(e => e.Id);

            builder.Property(e => e.TeamId).IsRequired();
            builder.Property(e => e.TeamPlayerId).IsRequired();
            builder.Property(e => e.SessionName).HasMaxLength(300).IsRequired();
            builder.Property(e => e.SessionDate).IsRequired();
            builder.Property(e => e.CreatedByUserId).IsRequired();
            builder.Property(e => e.CreatedAt).IsRequired();
            builder.Property(e => e.UpdatedAt).IsRequired();

            builder.HasIndex(e => new { e.TeamPlayerId, e.TrainingSessionId }).IsUnique();
            builder.HasIndex(e => new { e.TeamId, e.SessionDate });

            builder.HasOne<TeamPlayer>()
                .WithMany()
                .HasForeignKey(e => e.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(e => e.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            // SetNull: el seguimiento es un registro para hablar con la familia; sobrevive al borrado de la
            // sesión gracias al nombre y la fecha guardados.
            builder.HasOne<TrainingSession>()
                .WithMany()
                .HasForeignKey(e => e.TrainingSessionId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasMany(e => e.Subprincipios)
                .WithOne()
                .HasForeignKey(s => s.PlayerSessionEvaluationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(e => e.Subprincipios).UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }

    internal class SubprincipioEvaluationEntityConfiguration : IEntityTypeConfiguration<SubprincipioEvaluation>
    {
        public void Configure(EntityTypeBuilder<SubprincipioEvaluation> builder)
        {
            builder.ToTable("PlayerSessionSubprincipioEvaluations");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.PlayerSessionEvaluationId).IsRequired();
            builder.Property(s => s.MomentName).HasMaxLength(SubprincipioEvaluation.Rules.LabelMaxLength).IsRequired();
            builder.Property(s => s.PrincipleLabel).HasMaxLength(SubprincipioEvaluation.Rules.LabelMaxLength).IsRequired();
            builder.Property(s => s.SubprincipioLabel).HasMaxLength(SubprincipioEvaluation.Rules.LabelMaxLength).IsRequired();
            builder.Property(s => s.Assessment).IsRequired();
            builder.Property(s => s.Comment).HasMaxLength(SubprincipioEvaluation.Rules.CommentMaxLength).IsRequired(false);

            builder.HasOne<Subprincipio>()
                .WithMany()
                .HasForeignKey(s => s.SubprincipioId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
