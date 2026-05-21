using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonAccess
{
    internal class SeasonAccessTrialDayRatingEntityConfiguration : IEntityTypeConfiguration<SeasonAccessTrialDayRating>
    {
        public void Configure(EntityTypeBuilder<SeasonAccessTrialDayRating> builder)
        {
            builder.ToTable("SeasonAccessTrialDayRatings");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.TrialDayId).IsRequired();
            builder.Property(x => x.TrialPlayerId).IsRequired();
            builder.Property(x => x.Score).HasColumnType("numeric(5,2)");
            builder.Property(x => x.Notes).HasMaxLength(1000);
            builder.Property(x => x.Status).HasMaxLength(50);
            builder.Property(x => x.IdealDemarcationId);
            builder.Property(x => x.TotalGoals).IsRequired(false);
            builder.Property(x => x.PossibleDemarcationIds).HasColumnType("integer[]");

            builder.HasIndex(x => new { x.TrialDayId, x.TrialPlayerId }).IsUnique();
        }
    }
}
