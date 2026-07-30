using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.News;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class NewsItemEntityConfiguration : IEntityTypeConfiguration<NewsItem>
    {
        public void Configure(EntityTypeBuilder<NewsItem> builder)
        {
            builder.ToTable("News");

            builder.HasKey(n => n.Id);

            builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
            builder.Property(n => n.Subtitle).HasMaxLength(300).IsRequired();
            builder.Property(n => n.Body).IsRequired();
            builder.Property(n => n.CoverImageUrl).HasMaxLength(2000).IsRequired();
            builder.Property(n => n.Status).IsRequired();
            builder.Property(n => n.PublishedAt).IsRequired(false);
            builder.Property(n => n.NewsDate).IsRequired();
            builder.Property(n => n.CreatedAt).IsRequired();
            builder.Property(n => n.UpdatedAt).IsRequired();

            builder.HasIndex(n => new { n.Status, n.PublishedAt });
        }
    }
}
