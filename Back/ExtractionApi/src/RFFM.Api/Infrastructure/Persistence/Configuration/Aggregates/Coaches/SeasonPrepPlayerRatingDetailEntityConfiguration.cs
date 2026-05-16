using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.Coaches;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Coaches
{
    internal class SeasonPrepPlayerRatingDetailEntityConfiguration : IEntityTypeConfiguration<SeasonPrepPlayerRatingDetail>
    {
        public void Configure(EntityTypeBuilder<SeasonPrepPlayerRatingDetail> builder)
        {
            builder.ToTable("SeasonPrepPlayerRatingDetails");
            builder.HasKey(d => d.Id);

            builder.Property(d => d.RatingId).IsRequired();
            builder.Property(d => d.CharacteristicKey).IsRequired().HasMaxLength(50);
            builder.Property(d => d.CategoryKey).IsRequired().HasMaxLength(20);
            builder.Property(d => d.Level).IsRequired();
            builder.Property(d => d.Concept).IsRequired().HasMaxLength(200);

            builder.HasOne(d => d.Rating)
                .WithMany(r => r.Details)
                .HasForeignKey(d => d.RatingId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(d => d.RatingId);
            builder.HasIndex(d => new { d.RatingId, d.CharacteristicKey }).IsUnique();
        }
    }
}