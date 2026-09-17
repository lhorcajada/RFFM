using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PlayerDocuments;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class PlayerDocumentEntityConfiguration : IEntityTypeConfiguration<PlayerDocument>
    {
        public void Configure(EntityTypeBuilder<PlayerDocument> builder)
        {
            builder.ToTable("PlayerDocuments");
            builder.HasKey(d => d.Id);

            builder.Property(d => d.TeamPlayerId).IsRequired();
            builder.Property(d => d.DocumentTypeId).IsRequired();
            builder.Property(d => d.Status).IsRequired();
            builder.Property(d => d.FileName).HasMaxLength(255).IsRequired();
            builder.Property(d => d.StorageUrl).HasMaxLength(1000).IsRequired();
            builder.Property(d => d.ContentType).HasMaxLength(100).IsRequired();
            builder.Property(d => d.UploadedAt).IsRequired();
            builder.Property(d => d.UploadedByUserId).IsRequired();
            builder.Property(d => d.UploadedOnBehalf).IsRequired().HasDefaultValue(false);
            builder.Property(d => d.ReviewedByUserId).IsRequired(false);
            builder.Property(d => d.ReviewedAt).IsRequired(false);
            builder.Property(d => d.ReviewNote).HasMaxLength(1000).IsRequired(false);

            builder.HasIndex(d => new { d.TeamPlayerId, d.DocumentTypeId }).IsUnique();

            builder.HasOne<RFFM.Api.Domain.Entities.TeamPlayers.TeamPlayer>()
                .WithMany()
                .HasForeignKey(d => d.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<DocumentType>()
                .WithMany()
                .HasForeignKey(d => d.DocumentTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
