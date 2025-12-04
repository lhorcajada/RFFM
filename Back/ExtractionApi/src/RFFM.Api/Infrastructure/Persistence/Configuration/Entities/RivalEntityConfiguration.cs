using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class RivalEntityConfiguration : IEntityTypeConfiguration<Rival>
    {
        public void Configure(EntityTypeBuilder<Rival> builder)
        {
            builder.ToTable("Rivals");

            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(c => c.UrlPhoto)
                .HasMaxLength(256);

            builder.HasKey(c => c.Id);

        }
    }
}
