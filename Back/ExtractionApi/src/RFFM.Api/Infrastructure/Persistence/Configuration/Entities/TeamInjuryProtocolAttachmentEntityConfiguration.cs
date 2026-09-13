using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class TeamInjuryProtocolAttachmentEntityConfiguration : IEntityTypeConfiguration<TeamInjuryProtocolAttachment>
    {
        public void Configure(EntityTypeBuilder<TeamInjuryProtocolAttachment> builder)
        {
            builder.ToTable("TeamInjuryProtocolAttachments");

            builder.HasKey(a => a.Id);

            builder.Property(a => a.ProtocolId).IsRequired();
            builder.Property(a => a.FileName).HasMaxLength(500).IsRequired();
            builder.Property(a => a.StorageUrl).HasMaxLength(2000).IsRequired();
            builder.Property(a => a.ContentType).HasMaxLength(200).IsRequired();
            builder.Property(a => a.UploadedAt).IsRequired();

            builder.HasIndex(a => a.ProtocolId);

            builder.HasOne(a => a.Protocol)
                .WithMany(p => p.Attachments)
                .HasForeignKey(a => a.ProtocolId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
