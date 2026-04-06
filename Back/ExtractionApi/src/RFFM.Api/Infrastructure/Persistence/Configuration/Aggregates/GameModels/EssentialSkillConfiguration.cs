using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class EssentialSkillConfiguration : IEntityTypeConfiguration<EssentialSkill>
    {
        public void Configure(EntityTypeBuilder<EssentialSkill> builder)
        {
            builder.ToTable("EssentialSkills");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.SubSubPrincipleId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Description)
                .HasMaxLength(2000);

            builder.Property(x => x.MasteredAt)
                .IsRequired(false);
        }
    }
}
