using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.SeasonAccess
{
    internal class SeasonAccessTrialDayEntityConfiguration : IEntityTypeConfiguration<SeasonAccessTrialDay>
    {
        public void Configure(EntityTypeBuilder<SeasonAccessTrialDay> builder)
        {
            builder.ToTable("SeasonAccessTrialDays");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.TrialId).IsRequired();
            builder.Property(x => x.Date).IsRequired();
            builder.Property(x => x.Label).HasMaxLength(200);

            builder.HasIndex(x => x.TrialId);

            builder.HasMany(x => x.Ratings)
                .WithOne(x => x.TrialDay)
                .HasForeignKey(x => x.TrialDayId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
