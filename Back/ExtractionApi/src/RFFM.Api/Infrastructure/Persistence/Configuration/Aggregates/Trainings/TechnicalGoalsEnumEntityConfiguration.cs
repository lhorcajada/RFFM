using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TechnicalGoalsEnumEntityConfiguration : IEntityTypeConfiguration<TechnicalGoalsEnum>
    {
        public void Configure(EntityTypeBuilder<TechnicalGoalsEnum> builder)
        {
            builder.ToTable("TechnicalGoals");

            builder.HasKey(tg => tg.Id);

            builder.Property(tg => tg.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasData(TechnicalGoalsEnum.List().Select(tg => new { tg.Id, tg.Name }));
        }
    }
}