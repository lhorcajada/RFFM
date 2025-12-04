using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class SportEventEntityConfiguration : IEntityTypeConfiguration<SportEvent>
    {
        public void Configure(EntityTypeBuilder<SportEvent> builder)
        {
            builder.ToTable("SportEvents");
            builder.HasKey(se => se.Id);

            builder.Property(se => se.Name)
                .IsRequired()
                .HasMaxLength(ValidationAssistancesConstants.MaxNameLength);

            builder.Property(se => se.EveDateTime)
                .IsRequired();

            builder.Property(se => se.StartTime)
                .IsRequired();

            builder.Property(se => se.EndTime)
                .IsRequired(false);

            builder.Property(se => se.ArrivalDate)
                .IsRequired(false);

            builder.Property(se => se.Location)
                .IsRequired(false)
                .HasMaxLength(ValidationAssistancesConstants.MaxLocationLength);

            builder.Property(se => se.Description)
                .IsRequired(false)
                .HasMaxLength(ValidationAssistancesConstants.MaxDescriptionLength);

            builder.Property(se => se.EventTypeId)
                .IsRequired();

            builder.Property(se => se.TeamId)
                .IsRequired();

            builder.HasOne(se => se.Team)
                .WithMany()
                .HasForeignKey(se => se.TeamId);

            builder.HasOne(se => se.SportEventType)
                .WithMany()
                .HasForeignKey(se => se.EventTypeId);

            builder.HasMany(se => se.Called)
                .WithOne(c => c.SportEvent)
                .HasForeignKey(c => c.SportEventId);
            builder.HasOne(se => se.Rival)
                .WithMany()
                .HasForeignKey(se => se.RivalId);
        }
    }
}