using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Training;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Trainings
{
    internal class TacticalGoalsEnumEntityConfiguration : IEntityTypeConfiguration<TacticalGoalsEnum>
    {
        public void Configure(EntityTypeBuilder<TacticalGoalsEnum> builder)
        {
            builder.ToTable("TacticalGoals");

            builder.HasKey(tg => tg.Id);

            builder.Property(tg => tg.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.HasData(TacticalGoalsEnum.List().Select(tg => new { tg.Id, tg.Name }));
        }
    }
}