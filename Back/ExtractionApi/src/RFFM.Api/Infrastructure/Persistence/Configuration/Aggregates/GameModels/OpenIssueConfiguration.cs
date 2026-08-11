using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.GameModels;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.GameModels
{
    internal class OpenIssueConfiguration : IEntityTypeConfiguration<OpenIssue>
    {
        public void Configure(EntityTypeBuilder<OpenIssue> builder)
        {
            builder.ToTable("OpenIssues");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.Id)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.GameModelId)
                .IsRequired()
                .HasMaxLength(36);

            builder.Property(x => x.Topic)
                .IsRequired()
                .HasMaxLength(300);

            builder.Property(x => x.Description)
                .HasMaxLength(4000);

            builder.Property(x => x.Status)
                .IsRequired()
                .HasMaxLength(20);
        }
    }
}
