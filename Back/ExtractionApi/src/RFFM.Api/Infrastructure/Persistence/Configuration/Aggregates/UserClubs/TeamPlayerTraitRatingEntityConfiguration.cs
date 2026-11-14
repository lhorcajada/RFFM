using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerTraitRatingEntityConfiguration : IEntityTypeConfiguration<TeamPlayerTraitRating>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerTraitRating> builder)
        {
            builder.ToTable("TeamPlayerTraitRatings");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.RatedAt).IsRequired();
            builder.Property(r => r.Trend).IsRequired().HasMaxLength(10).HasDefaultValue(TraitTrend.Same);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(r => new { r.TeamPlayerId, r.RatedAt });

            builder.Navigation(r => r.Levels)
                .UsePropertyAccessMode(PropertyAccessMode.Field)
                .HasField("_levels");
        }
    }

    internal class TeamPlayerTraitRatingLevelEntityConfiguration : IEntityTypeConfiguration<TeamPlayerTraitRatingLevel>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerTraitRatingLevel> builder)
        {
            builder.ToTable("TeamPlayerTraitRatingLevels");
            builder.HasKey(l => l.Id);

            builder.Property(l => l.RatingId).IsRequired();
            builder.Property(l => l.TraitKey).IsRequired().HasMaxLength(50);
            builder.Property(l => l.Level).IsRequired();

            builder.HasOne(l => l.Rating)
                .WithMany(r => r.Levels)
                .HasForeignKey(l => l.RatingId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(l => new { l.RatingId, l.TraitKey }).IsUnique();
        }
    }
}
