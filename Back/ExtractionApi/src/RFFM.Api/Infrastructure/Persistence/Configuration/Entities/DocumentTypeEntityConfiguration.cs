using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.PlayerDocuments;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class DocumentTypeEntityConfiguration : IEntityTypeConfiguration<DocumentType>
    {
        public void Configure(EntityTypeBuilder<DocumentType> builder)
        {
            builder.ToTable("DocumentTypes");
            builder.HasKey(d => d.Id);
            builder.Property(d => d.Name).HasMaxLength(200).IsRequired();
            builder.Property(d => d.Description).HasMaxLength(1000).IsRequired(false);
            builder.Property(d => d.IsActive).IsRequired().HasDefaultValue(true);
        }
    }
}
