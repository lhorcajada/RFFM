using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TaskTrainingSkillConfiguration : IEntityTypeConfiguration<TaskTrainingSkill>
    {
        public void Configure(EntityTypeBuilder<TaskTrainingSkill> builder)
        {
            builder.ToTable("TaskTrainingSkills");

            builder.HasKey(tts => new { tts.TaskTrainingBaseId, tts.EssentialSkillId });

            builder.Property(tts => tts.TaskTrainingBaseId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(tts => tts.EssentialSkillId)
                .IsRequired()
                .HasMaxLength(36);

            builder.HasOne(tts => tts.TaskTrainingBase)
                .WithMany(tb => tb.Skills)
                .HasForeignKey(tts => tts.TaskTrainingBaseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(tts => tts.EssentialSkill)
                .WithMany()
                .HasForeignKey(tts => tts.EssentialSkillId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
