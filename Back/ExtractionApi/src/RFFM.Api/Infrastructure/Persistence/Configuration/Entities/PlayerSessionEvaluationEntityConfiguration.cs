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

            builder.HasMany(e => e.Comments)
                .WithOne()
                .HasForeignKey(c => c.PlayerSessionEvaluationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(e => e.Comments).UsePropertyAccessMode(PropertyAccessMode.Field);
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

    internal class CommentEvaluationEntityConfiguration : IEntityTypeConfiguration<CommentEvaluation>
    {
        public void Configure(EntityTypeBuilder<CommentEvaluation> builder)
        {
            builder.ToTable("PlayerSessionCommentEvaluations");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.PlayerSessionEvaluationId).IsRequired();
            builder.Property(c => c.Title).HasMaxLength(TrackingComment.Rules.TitleMaxLength).IsRequired();
            builder.Property(c => c.Assessment).IsRequired();
            builder.Property(c => c.Note).HasMaxLength(CommentEvaluation.Rules.NoteMaxLength).IsRequired(false);

            // SetNull: la valoración se conserva con su título aunque el comentario salga del catálogo.
            builder.HasOne<TrackingComment>()
                .WithMany()
                .HasForeignKey(c => c.TrackingCommentId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

    internal class TrackingCommentEntityConfiguration : IEntityTypeConfiguration<TrackingComment>
    {
        public void Configure(EntityTypeBuilder<TrackingComment> builder)
        {
            builder.ToTable("TrackingComments");

            builder.HasKey(c => c.Id);

            builder.Property(c => c.TeamId).IsRequired();
            builder.Property(c => c.Title).HasMaxLength(TrackingComment.Rules.TitleMaxLength).IsRequired();
            builder.Property(c => c.Description).HasMaxLength(TrackingComment.Rules.DescriptionMaxLength).IsRequired(false);
            builder.Property(c => c.CreatedByUserId).IsRequired();
            builder.Property(c => c.CreatedAt).IsRequired();

            builder.HasIndex(c => new { c.TeamId, c.Title });

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(c => c.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
