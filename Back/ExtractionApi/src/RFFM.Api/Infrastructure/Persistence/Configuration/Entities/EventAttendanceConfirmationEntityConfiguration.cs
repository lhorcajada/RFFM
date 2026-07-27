using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Entities;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class EventAttendanceConfirmationEntityConfiguration : IEntityTypeConfiguration<EventAttendanceConfirmation>
    {
        public void Configure(EntityTypeBuilder<EventAttendanceConfirmation> builder)
        {
            builder.ToTable("EventAttendanceConfirmations");

            builder.HasKey(eac => eac.Id);
            builder.HasIndex(eac => eac.Id).IsUnique();
            builder.HasIndex(eac => new { eac.SportEventId, eac.TeamPlayerId }).IsUnique();

            builder.Property(eac => eac.SportEventId)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(eac => eac.TeamPlayerId)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(eac => eac.ConfirmedByApplicationUserId)
                .IsRequired()
                .HasMaxLength(450); // AspNetCore Identity user ID max length

            builder.Property(eac => eac.AttendanceStatusId)
                .IsRequired();

            builder.Property(eac => eac.RespondedAt)
                .IsRequired(false);
        }
    }
}
