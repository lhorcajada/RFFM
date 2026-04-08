using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerRatingEntityConfiguration : IEntityTypeConfiguration<TeamPlayerRating>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerRating> builder)
        {
            builder.ToTable("TeamPlayerRatings");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.Technical).IsRequired();
            builder.Property(r => r.Tactical).IsRequired();
            builder.Property(r => r.Physical).IsRequired();
            builder.Property(r => r.Competitiveness).IsRequired();
            builder.Property(r => r.RatedAt).IsRequired();
            builder.Property(r => r.Notes).IsRequired(false).HasMaxLength(500);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(r => r.TeamPlayerId);
            builder.HasIndex(r => r.RatedAt);
        }
    }
}
